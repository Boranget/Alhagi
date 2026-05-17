import { ref, watch, nextTick } from 'vue'
import { Editor, rootCtx, defaultValueCtx, editorStateCtx, editorViewCtx, serializerCtx, schemaCtx } from '@milkdown/core'
import { DOMSerializer } from '@milkdown/prose'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { EditorState } from '@milkdown/prose/state'
import { EditorView } from '@milkdown/prose/view'
import type { ViewMode } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'
import { PerformanceMonitor, LRUCache, Debouncer } from '@/utils/performance'
import { 
  SearchConfig, 
  MatchRange,
  findMatchesInDocument,
  replaceInProseMirror,
  replaceAllInProseMirror
} from '@/utils/search'
import { searchHighlightPlugin, setSearchQuery, clearSearchHighlight } from './searchHighlightPlugin'

export interface EditorConfig {
  enablePolling: boolean
  pollingInterval: number
  cacheSize: number
  enableMetrics: boolean
}

/** 编辑器上下文类型 */
interface EditorContext {
  get: (key: unknown) => unknown
}

/** 监听器上下文类型 */
interface ListenerContext {
  markdownUpdated: (cb: (ctx: unknown, markdown: string, prevMarkdown: string) => void) => void
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
  private debouncer: Debouncer
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
    this.debouncer = new Debouncer()
    this.monitor = new PerformanceMonitor()
  }

  private createEditorConfig(container: HTMLElement, content: string) {
    return (ctx: unknown) => {
      const context = ctx as EditorContext & { set: (key: unknown, value: unknown) => void }
      context.set(rootCtx, container)
      context.set(defaultValueCtx, content)

      const listenerPlugin = context.get(listenerCtx) as ListenerContext
      
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
      .use(searchHighlightPlugin())
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
      await this.waitForEditorReady()
      
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

  private async waitForEditorReady(maxWait: number = 5000): Promise<void> {
    const startTime = Date.now()
    
    while (!this.isEditorReady && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    if (!this.isEditorReady) {
      throw new Error('Editor did not become ready within timeout')
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
    if (!this.isReady()) {
      return this.content
    }
    return this.content || this.tabsStore.activeTab?.content || ''
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
          const context = ctx as { get: (key: unknown) => unknown }
          
          const editorState = context.get(editorStateCtx)
          const editorView = context.get(editorViewCtx)
          
          if (editorState && editorView) {
            const state = editorState as { tr: { replaceWith: Function }; doc: { content: { size: number } } }
            const view = editorView as { dispatch: Function }
            
            const { dom: { parser } } = ctx as { dom: { parser: { parse: Function } } }
            
            if (parser) {
              const newDoc = parser.parse(content)
              const tr = state.tr.replaceWith(
                0,
                state.doc.content.size,
                newDoc.content
              )
              view.dispatch(tr)
              success = true
            }
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
    if (this.container) {
      requestAnimationFrame(() => {
        if (this.container) {
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
          const context = ctx as { get: (key: unknown) => unknown }
          const editorView = context.get(editorViewCtx)
          
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
    this.debouncer.cancel()
    
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
      const context = ctx as { get: (key: unknown) => unknown }
      const editorView = context.get(editorViewCtx)
      
      if (editorView) {
        const view = editorView as { dispatch: (tr: any) => void; state: any }
        
        if (config.search.trim()) {
          const tr = view.state.tr.setMeta('search', config)
          view.dispatch(tr)
        } else {
          const tr = view.state.tr.setMeta('search', {
            search: '',
            caseSensitive: false,
            wholeWord: false,
            regexp: false
          })
          view.dispatch(tr)
        }
      }
    })
  }

  clearSearchHighlight(): void {
    this.setSearchHighlight({
      search: '',
      caseSensitive: false,
      wholeWord: false,
      regexp: false
    })
  }

  getEditorView() {
    if (!this.editor || !this.isReady()) {
      return null
    }

    let view = null
    this.editor.action((ctx) => {
      const context = ctx as { get: (key: unknown) => unknown }
      view = context.get(editorViewCtx)
    })
    return view
  }

  findMatches(config: SearchConfig): MatchRange[] {
    if (!this.editor || !this.isReady()) {
      return []
    }

    let matches: MatchRange[] = []
    this.editor.action((ctx) => {
      const context = ctx as { get: (key: unknown) => unknown }
      const state = context.get(editorStateCtx) as any
      if (state?.doc) {
        matches = findMatchesInDocument(state.doc, config)
      }
    })
    return matches
  }

  replaceMatch(config: SearchConfig, match: MatchRange, replacement: string): boolean {
    const view = this.getEditorView() as any
    if (!view) {
      return false
    }
    const result = replaceInProseMirror(view, match.from, match.to, replacement)
    return result.success
  }

  replaceAll(config: SearchConfig, replacement: string): number {
    const matches = this.findMatches(config)
    if (matches.length === 0) {
      return 0
    }

    const view = this.getEditorView() as any
    if (!view) {
      return 0
    }

    const result = replaceAllInProseMirror(view, matches, replacement)
    return result.success ? matches.length : 0
  }

  getHTML(): string {
    if (!this.editor || !this.isReady()) {
      return ''
    }

    let html = ''
    this.editor.action((ctx) => {
      const context = ctx as { get: (key: unknown) => unknown }
      const schema = context.get(schemaCtx) as any
      const view = context.get(editorViewCtx) as any

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
    getHTML
  }
}
