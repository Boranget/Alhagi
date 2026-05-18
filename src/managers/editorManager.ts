import { ref, watch, nextTick } from 'vue'
import { 
  Editor, 
  rootCtx, 
  defaultValueCtx, 
  editorStateCtx, 
  editorViewCtx, 
  serializerCtx, 
  schemaCtx, 
  parserCtx 
} from '@milkdown/core'
import { DOMSerializer } from '@milkdown/prose/model'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { prism } from '@milkdown/plugin-prism'
import { block } from '@milkdown/plugin-block'
import { EditorState } from '@milkdown/prose/state'
import { EditorView } from '@milkdown/prose/view'
import { SearchQuery, setSearchState, getSearchState, findNext, findPrev, replaceNext, replaceAll as prosemirrorReplaceAll } from 'prosemirror-search'
import type { ViewMode } from '@/types'
import type { MilkdownEditorContext, ListenerPluginContext, EditorActionContext } from '@/types/milkdown'
import type { Schema } from '@milkdown/prose/model'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'
import { PerformanceMonitor, LRUCache } from '@/utils/performance'
import { 
  SearchConfig, 
  MatchRange,
  findMatchesInContent,
  replaceAllInContent,
  replaceSingleMatch
} from '@/utils/search'
import { searchHighlightPlugin, createSearchQuery, type SearchHighlightPlugin } from './searchHighlightPlugin'

export interface EditorConfig {
  enablePolling: boolean
  pollingInterval: number
  cacheSize: number
  enableMetrics: boolean
}

const DEFAULT_CONFIG: EditorConfig = {
  enablePolling: true,
  pollingInterval: 500,
  cacheSize: 10,
  enableMetrics: true
}

export class EditorInstanceManager {
  private editor: Editor | null = null
  private isInitialized = false
  private isDestroyed = false
  private isEditorReady = false
  private container: HTMLElement | null = null
  private currentTabId: string | null = null
  private content: string = ''
  private isUpdatingContent = false
  private pollingInterval: number | null = null
  private readonly pollingDelay: number
  private config: EditorConfig
  private contentCache: LRUCache<string>
  private monitor: PerformanceMonitor
  private readonly MAX_RETRIES = 3
  private retryCount = 0

  constructor(
    private tabsStore: ReturnType<typeof useTabsStore>,
    config: Partial<EditorConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.pollingDelay = this.config.pollingInterval
    this.contentCache = new LRUCache<string>(this.config.cacheSize)
    this.monitor = new PerformanceMonitor()
  }

  private createEditorConfig(container: HTMLElement, content: string) {
    return (ctx: unknown) => {
      const context = ctx as MilkdownEditorContext
      context.set(rootCtx, container)
      context.set(defaultValueCtx, content)

      const listenerPlugin = context.get(listenerCtx) as ListenerPluginContext
      
      listenerPlugin.markdownUpdated((_ctx: unknown, markdown: string, prevMarkdown: string) => {
        if (this.currentTabId && markdown !== prevMarkdown && !this.isUpdatingContent) {
          this.content = markdown
          this.contentCache.set(this.currentTabId, markdown)
          
          this.tabsStore.updateTab(this.currentTabId, {
            content: markdown,
            isDirty: true,
            lastModified: Date.now()
          })
          
          eventBus.emit(AppEvents.CONTENT_CHANGED, {
            content: markdown,
            tabId: this.currentTabId
          })
        }
      })
    }
  }

  private async createEditor(container: HTMLElement, content: string): Promise<Editor> {
    return Editor.make()
      .config(this.createEditorConfig(container, content))
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .use(prism)
      .use(block)
      .use(searchHighlightPlugin as unknown as any)
      .create()
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    if (this.isInitialized || this.isDestroyed) {
      return
    }

    this.monitor.measure('editorInit')
    
    this.container = container
    this.currentTabId = tabId || this.tabsStore.activeTabId
    this.content = initialContent
    
    if (tabId) {
      this.contentCache.set(tabId, initialContent)
    }

    try {
      this.editor = await this.createEditor(container, initialContent)
      
      await nextTick()
      
      this.isEditorReady = true
      this.isInitialized = true
      this.retryCount = 0
      
      if (this.config.enablePolling) {
        this.startPolling()
      }
      
      const initDuration = this.monitor.measureEnd('editorInit')
      this.monitor.recordInitialization(initDuration)
      this.monitor.recordEditorReady()
      
      eventBus.emit(AppEvents.EDITOR_READY, { tabId: this.currentTabId })
    } catch (error) {
      console.error('Editor initialization failed:', error)
      await this.handleInitializationError(error as Error, container, initialContent)
    }
  }

  private async handleInitializationError(
    error: Error,
    container: HTMLElement,
    content: string
  ): Promise<void> {
    this.retryCount++
    
    if (this.retryCount <= this.MAX_RETRIES) {
      console.warn(`Editor initialization failed, retry ${this.retryCount}/${this.MAX_RETRIES}`)
      
      await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount))
      
      try {
        if (this.container && this.content) {
          this.editor = await this.createEditor(this.container, this.content)
          await nextTick()
          this.isEditorReady = true
          this.isInitialized = true
          return
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError)
        await this.handleInitializationError(retryError as Error, container, content)
      }
    } else {
      console.error('Max retries reached, editor initialization failed permanently')
      this.isDestroyed = true
      throw error
    }
  }

  getMarkdown(): string {
    if (!this.editor || !this.isReady()) {
      return this.content
    }

    let markdown = ''
    this.editor.action((ctx) => {
      const context = ctx as EditorActionContext
      const serializer = context.get(serializerCtx) as unknown as { (doc: unknown): string }
      const view = context.get(editorViewCtx) as EditorView

      if (serializer && view) {
        markdown = serializer(view.state.doc)
      }
    })

    return markdown || this.content || this.tabsStore.activeTab?.content || ''
  }

  async setMarkdown(content: string): Promise<void> {
    if (!this.editor || !this.isReady()) {
      console.warn('Editor not ready for setMarkdown')
      return
    }
    
    if (this.content === content) {
      return
    }

    this.monitor.measure('setMarkdown')
    
    try {
      this.isUpdatingContent = true
      this.content = content
      
      if (this.currentTabId) {
        this.contentCache.set(this.currentTabId, content)
      }

      const success = await this.dispatchContentChange(content)
      
      if (!success) {
        console.warn('Direct dispatch failed, attempting alternative method')
        await this.setMarkdownAlternative(content)
      }
      
      const duration = this.monitor.measureEnd('setMarkdown')
      this.monitor.recordSetMarkdown(duration)
      
    } catch (error) {
      console.error('Failed to set markdown:', error)
      await this.handleSetMarkdownError(error as Error, content)
    } finally {
      this.isUpdatingContent = false
    }
  }

  private dispatchContentChange(content: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        let success = false
        
        this.editor!.action((ctx) => {
          const context = ctx as EditorActionContext
          
          const editorState = context.get(editorStateCtx) as EditorState
          const editorView = context.get(editorViewCtx) as EditorView
          const parser = context.get(parserCtx) as unknown as (text: string) => { content: any }
          
          if (editorState && editorView && parser) {
            const newDoc = parser(content)
            const tr = editorState.tr.replaceWith(
              0,
              editorState.doc.content.size,
              newDoc.content
            )
            editorView.dispatch(tr)
            success = true
          }
        })
        
        resolve(success)
      } catch (error) {
        resolve(false)
      }
    })
  }

  private async setMarkdownAlternative(content: string): Promise<void> {
    console.warn('Using alternative markdown setter')
    
    if (this.currentTabId) {
      const cached = this.contentCache.get(this.currentTabId)
      if (cached === content) {
        return
      }
    }
    
    this.content = content
  }

  private async handleSetMarkdownError(error: Error, content: string): Promise<void> {
    console.error('Set markdown failed:', error)
    
    this.content = content
    
    if (this.currentTabId) {
      this.contentCache.set(this.currentTabId, content)
    }
  }

  getSelection(): { from: number; to: number } {
    return this.tabsStore.activeTab?.cursor || { from: 0, to: 0 }
  }

  setSelection(from: number, to: number): void {
    if (this.tabsStore.activeTabId) {
      this.tabsStore.updateTab(this.tabsStore.activeTabId, {
        cursor: { from, to }
      })
      eventBus.emit(AppEvents.CURSOR_CHANGED, {
        from,
        to,
        tabId: this.tabsStore.activeTabId
      })
    }
  }

  getScrollTop(): number {
    return this.container?.scrollTop || 0
  }

  setScrollTop(position: number): void {
    if (this.container && this.currentTabId) {
      requestAnimationFrame(() => {
        if (this.container && this.currentTabId) {
          this.container.scrollTop = position
          eventBus.emit(AppEvents.SCROLL_CHANGED, {
            scrollTop: position,
            tabId: this.currentTabId
          })
        }
      })
    }
  }

  focus(): void {
    this.container?.focus()
  }

  async switchToTab(tabId: string): Promise<void> {
    if (!this.editor || !this.container) {
      console.warn('Editor not initialized')
      return
    }

    this.monitor.measure('switchTab')

    if (!this.isEditorReady) {
      console.warn('Editor not ready for tab switch')
      await nextTick()
    }

    const currentTab = this.tabsStore.activeTab
    const targetTab = this.tabsStore.tabs.get(tabId)

    if (!targetTab) {
      console.error('Tab not found:', tabId)
      return
    }

    if (currentTab && currentTab.id !== tabId) {
      currentTab.scrollTop = this.getScrollTop()
      currentTab.lastModified = Date.now()
    }

    this.tabsStore.switchTab(tabId)
    this.currentTabId = tabId
    
    const cachedContent = this.contentCache.get(tabId)
    const contentToLoad = cachedContent || targetTab.content
    
    await this.setMarkdown(contentToLoad)
    this.setScrollTop(targetTab.scrollTop)
    
    const duration = this.monitor.measureEnd('switchTab')
    this.monitor.recordSwitchTab(duration)
  }

  private startPolling(): void {
    if (this.pollingInterval !== null) {
      return
    }

    this.pollingInterval = window.setInterval(() => {
      if (this.isDestroyed || !this.isEditorReady) {
        return
      }
      
      this.monitor.recordPolling()
      this.verifyEditorState()
    }, this.pollingDelay)
  }

  private stopPolling(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  private verifyEditorState(): void {
    try {
      if (this.editor && this.isEditorReady) {
        this.editor.action((ctx) => {
          const context = ctx as EditorActionContext
          const editorView = context.get(editorViewCtx) as EditorView
          
          if (!editorView) {
            console.warn('Editor view not available')
            this.isEditorReady = false
            this.monitor.recordPollingError()
          }
        })
      }
    } catch (error) {
      console.warn('Editor state verification failed:', error)
      this.monitor.recordPollingError()
    }
  }

  async destroy(): Promise<void> {
    if (this.isDestroyed) return

    this.stopPolling()

    if (this.currentTabId) {
      const tab = this.tabsStore.tabs.get(this.currentTabId)
      if (tab) {
        tab.content = this.content
        tab.scrollTop = this.getScrollTop()
      }
    }

    if (this.editor) {
      try {
        await this.editor.destroy()
      } catch (error) {
        console.warn('Error destroying editor:', error)
      }
      this.editor = null
    }

    eventBus.emit(AppEvents.EDITOR_DESTROYED, { tabId: this.currentTabId })

    this.contentCache.clear()
    
    if (this.config.enableMetrics) {
      console.log(this.monitor.getSummary())
    }
    this.monitor.reset()

    this.container = null
    this.currentTabId = null
    this.isInitialized = false
    this.isEditorReady = false
    this.isDestroyed = true
    this.content = ''
  }

  isReady(): boolean {
    return this.isInitialized && 
           !this.isDestroyed && 
           this.editor !== null &&
           this.isEditorReady
  }

  getEditor(): Editor | null {
    return this.editor
  }

  getContainer(): HTMLElement | null {
    return this.container
  }

  getCurrentTabId(): string | null {
    return this.currentTabId
  }

  getPollingStatus(): boolean {
    return this.pollingInterval !== null
  }

  getPerformanceMetrics(): PerformanceMonitor {
    return this.monitor
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.contentCache.size(),
      keys: Array.from(this.contentCache.keys())
    }
  }

  updateConfig(newConfig: Partial<EditorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (newConfig.enablePolling !== undefined) {
      if (newConfig.enablePolling && !this.getPollingStatus()) {
        this.startPolling()
      } else if (!newConfig.enablePolling && this.getPollingStatus()) {
        this.stopPolling()
      }
    }
  }

  async reloadEditor(): Promise<void> {
    if (!this.container || !this.content) {
      return
    }

    try {
      if (this.editor) {
        await this.editor.destroy()
      }
      
      this.editor = await this.createEditor(this.container, this.content)
      await nextTick()
      this.isEditorReady = true
      
      eventBus.emit(AppEvents.EDITOR_READY, { tabId: this.currentTabId })
    } catch (error) {
      console.error('Failed to reload editor:', error)
    }
  }

  setSearchHighlight(config: SearchConfig): void {
    if (!this.editor || !this.isReady()) {
      return
    }

    this.editor.action((ctx) => {
      const context = ctx as EditorActionContext
      const editorView = context.get(editorViewCtx) as EditorView
      
      if (editorView) {
        const query = createSearchQuery(config)
        const tr = setSearchState(editorView.state.tr, query)
        editorView.dispatch(tr)
      }
    })
  }

  clearSearchHighlight(): void {
    if (!this.editor || !this.isReady()) {
      return
    }

    this.editor.action((ctx) => {
      const context = ctx as EditorActionContext
      const editorView = context.get(editorViewCtx) as EditorView
      
      if (editorView) {
        const tr = setSearchState(editorView.state.tr, new SearchQuery({ search: '' }))
        editorView.dispatch(tr)
      }
    })
  }

  getEditorView(): EditorView | null {
    if (!this.editor || !this.isReady()) {
      return null
    }

    let view: EditorView | null = null
    this.editor.action((ctx) => {
      const context = ctx as EditorActionContext
      view = context.get(editorViewCtx) as EditorView
    })
    return view
  }

  findMatches(config: SearchConfig): MatchRange[] {
    if (!this.editor || !this.isReady()) {
      return []
    }

    const matches: MatchRange[] = []
    this.editor.action((ctx) => {
      const context = ctx as EditorActionContext
      const state = context.get(editorStateCtx) as EditorState
      if (state?.doc) {
        const query = createSearchQuery(config)
        if (!query.valid) return
        
        const doc = state.doc
        doc.descendants((node, pos) => {
          if (node.isText && node.text) {
            let patternString = config.search
            if (!config.regexp) {
              patternString = patternString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            }
            if (config.wholeWord) {
              patternString = `\\b${patternString}\\b`
            }
            const flags = config.caseSensitive ? 'g' : 'gi'
            try {
              const pattern = new RegExp(patternString, flags)
              let match: RegExpExecArray | null
              while ((match = pattern.exec(node.text)) !== null) {
                matches.push({
                  from: pos + match.index,
                  to: pos + match.index + match[0].length,
                  text: match[0]
                })
              }
            } catch {
              // Invalid regex, skip
            }
          }
          return true
        })
      }
    })
    return matches
  }

  replaceMatch(config: SearchConfig, match: MatchRange, replacement: string): boolean {
    const view = this.getEditorView()
    if (!view) {
      return false
    }
    
    const activeTab = this.tabsStore.activeTab
    if (!activeTab) return false
    
    const newContent = replaceSingleMatch(activeTab.content, match, replacement)
    this.tabsStore.updateTab(activeTab.id, {
      content: newContent,
      isDirty: true
    })
    
    return true
  }

  replaceAll(config: SearchConfig, replacement: string): number {
    const activeTab = this.tabsStore.activeTab
    if (!activeTab) return 0
    
    const matches = this.findMatches(config)
    if (matches.length === 0) {
      return 0
    }
    
    const newContent = replaceAllInContent(activeTab.content, config, replacement)
    this.tabsStore.updateTab(activeTab.id, {
      content: newContent,
      isDirty: true
    })
    
    return matches.length
  }

  findNextMatch(): boolean {
    if (!this.editor || !this.isReady()) {
      return false
    }

    let success = false
    this.editor.action((ctx) => {
      const context = ctx as EditorActionContext
      const editorView = context.get(editorViewCtx) as EditorView
      
      if (editorView) {
        const result = findNext(editorView.state, editorView.dispatch)
        success = result !== null
      }
    })
    return success
  }

  findPrevMatch(): boolean {
    if (!this.editor || !this.isReady()) {
      return false
    }

    let success = false
    this.editor.action((ctx) => {
      const context = ctx as EditorActionContext
      const editorView = context.get(editorViewCtx) as EditorView
      
      if (editorView) {
        const result = findPrev(editorView.state, editorView.dispatch)
        success = result !== null
      }
    })
    return success
  }

  getHTML(): string {
    if (!this.editor || !this.isReady()) {
      return ''
    }

    let html = ''
    this.editor.action((ctx) => {
      const context = ctx as EditorActionContext
      const schema = context.get(schemaCtx) as Schema
      const view = context.get(editorViewCtx) as EditorView

      if (schema && view) {
        const div = document.createElement('div')
        const fragment = DOMSerializer.fromSchema(schema).serializeFragment(view.state.doc.content)
        div.appendChild(fragment)
        html = div.innerHTML
      }
    })

    return html
  }
}

export function useEditorManager() {
  const tabsStore = useTabsStore()
  const containerRef = ref<HTMLElement | null>(null)
  const isReady = ref(false)
  const currentMode = ref<ViewMode>('wysiwyg')

  let manager: EditorInstanceManager | null = null

  const init = async () => {
    if (!containerRef.value || manager) return

    const activeTab = tabsStore.activeTab
    const initialContent = activeTab?.content || ''
    const tabId = activeTab?.id

    currentMode.value = activeTab?.viewMode || 'wysiwyg'

    manager = new EditorInstanceManager(tabsStore)
    await manager.init(containerRef.value, initialContent, tabId)
    isReady.value = manager.isReady()
  }

  const switchToTab = async (tabId: string) => {
    if (!manager) return
    const tab = tabsStore.tabs.get(tabId)
    if (tab) {
      currentMode.value = tab.viewMode
    }
    await manager.switchToTab(tabId)
  }

  const setViewMode = (mode: ViewMode) => {
    currentMode.value = mode
    if (tabsStore.activeTabId) {
      tabsStore.setViewMode(tabsStore.activeTabId, mode)
    }
  }

  const getManager = (): EditorInstanceManager | null => manager

  const destroy = async () => {
    if (manager) {
      await manager.destroy()
      manager = null
      isReady.value = false
    }
  }

  watch(() => tabsStore.activeTabId, (newTabId, oldTabId) => {
    if (newTabId && newTabId !== oldTabId && manager?.isReady()) {
      switchToTab(newTabId)
    }
  })

  const setSearchHighlight = (config: SearchConfig) => {
    manager?.setSearchHighlight(config)
  }

  const clearSearchHighlight = () => {
    manager?.clearSearchHighlight()
  }

  const getEditorView = () => {
    return manager?.getEditorView()
  }

  const findMatches = (config: SearchConfig): MatchRange[] => {
    return manager?.findMatches(config) || []
  }

  const replaceMatch = (config: SearchConfig, match: MatchRange, replacement: string): boolean => {
    return manager?.replaceMatch(config, match, replacement) || false
  }

  const replaceAll = (config: SearchConfig, replacement: string): number => {
    return manager?.replaceAll(config, replacement) || 0
  }

  const getHTML = (): string => {
    return manager?.getHTML() || ''
  }

  const getMarkdown = (): string => {
    return manager?.getMarkdown() || ''
  }

  const setMarkdown = async (content: string): Promise<void> => {
    await manager?.setMarkdown(content)
  }

  const findNextMatch = (): boolean => {
    return manager?.findNextMatch() || false
  }

  const findPrevMatch = (): boolean => {
    return manager?.findPrevMatch() || false
  }

  return {
    containerRef,
    isReady,
    currentMode,
    init,
    switchToTab,
    setViewMode,
    destroy,
    getManager,
    setSearchHighlight,
    clearSearchHighlight,
    getEditorView,
    findMatches,
    replaceMatch,
    replaceAll,
    getHTML,
    getMarkdown,
    setMarkdown,
    findNextMatch,
    findPrevMatch
  }
}
