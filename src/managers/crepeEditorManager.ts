import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx, parserCtx } from '@milkdown/kit/core'
import { insert, $prose, callCommand } from '@milkdown/kit/utils'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Slice } from '@milkdown/kit/prose/model'
import { Selection } from '@milkdown/kit/prose/state'
import { Plugin } from '@milkdown/kit/prose/state'
import { undoCommand, redoCommand } from '@milkdown/plugin-history'
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import { resolveImageToDisplayUrl, debounce } from '@/utils/helpers'
import type { ViewMode } from '@/types'
import type { HeadingItem } from '@/utils/headings'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { LRUCache } from '@/utils/performance'
import { generateSlug } from '@/utils/headings'
import { getSearchPlugin, useEditorSearchManager } from './EditorSearchManager'

const imagePathPlugin = $prose(() => new Plugin({
  view(editorView: any) {
    requestAnimationFrame(() => {
      fixImageSources(editorView.dom)
    })

    return {
      update() {
        fixImageSources(editorView.dom)
      }
    }
  }
}))

function fixImageSources(dom: Element): void {
  const tabsStore = useTabsStore()
  const activeTab = tabsStore.activeTab
  const mdFilePath = activeTab?.filePath || ''

  const imgs = dom.querySelectorAll('img')
  imgs.forEach((img) => {
    const src = img.getAttribute('src')
    if (!src) return
    const resolved = resolveImageToDisplayUrl(src, mdFilePath)
    if (resolved !== src) {
      img.src = resolved
    }
  })
}

export class CrepeEditorManager {
  private crepe: Crepe | null = null
  private content: string = ''
  private currentTabId: string | null = null
  private currentMode: ViewMode = 'wysiwyg'
  private contentCache: LRUCache<string>
  private isUpdatingContent = false
  private isInitialized = false
  private activeEditor: 'crepe' | 'codemirror' | null = null
  private container: HTMLElement | null = null
  private cursorChangeHandler: ((from: number, to: number) => void) | null = null
  private searchManager = useEditorSearchManager()

  constructor() {
    this.contentCache = new LRUCache<string>(20)
  }

  setActiveEditor(editor: 'crepe' | 'codemirror' | null): void {
    this.activeEditor = editor
    eventBus.emit(AppEvents.ACTIVE_EDITOR_CHANGED, { editor })
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.activeEditor
  }

  onCursorChange(handler: (from: number, to: number) => void): void {
    this.cursorChangeHandler = handler
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    if (!container) {
      console.error('[CrepeEditorManager] Container is undefined, cannot initialize')
      return
    }

    const startTime = performance.now()

    this.currentTabId = tabId || null
    this.container = container
    this.content = initialContent

    const isDark = this.isDarkMode()
    
    this.crepe = new Crepe({
      root: container,
      defaultValue: initialContent,
      features: {
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.Placeholder]: true,
        [Crepe.Feature.Cursor]: false,
      },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          theme: isDark ? undefined : eclipse,
        },
      },
    })

    this.crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(
          debounce((...args: unknown[]) => {
            const markdown = args[1] as string
            this.handleMarkdownUpdate(markdown)
          }, 200)
        )

        ctx.get(listenerCtx).updated((ctx) => {
          try {
            const view = ctx.get(editorViewCtx)
            const { from, to } = view.state.selection
            this.emitCursorChange(from, to)
          } catch {
            // 初始化时可能还拿不到 view
          }
        })
      })
      .use(listener)
      .use(getSearchPlugin())
      .use(imagePathPlugin)

    try {
      await this.crepe.create()
      this.searchManager.init(this.crepe.editor)
    } catch (error) {
      console.error('[CrepeEditorManager] crepe.create() failed:', error)
      throw error
    }

    this.isInitialized = true
    const initTime = performance.now() - startTime

    if (this.currentTabId) {
      eventBus.emit(AppEvents.EDITOR_READY, { tabId: this.currentTabId })
    } else {
      eventBus.emit(AppEvents.EDITOR_READY, { tabId: null })
    }
  }

  getMarkdown(): string {
    if (!this.crepe || !this.isInitialized) {
      console.warn('[CrepeEditorManager] Cannot get markdown: Crepe not initialized')
      return this.content
    }

    try {
      const markdown = this.crepe.getMarkdown()
      return markdown || this.content
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to get markdown:', error)
      return this.content
    }
  }

  async setMarkdown(content: string): Promise<void> {
    if (!this.crepe) {
      console.warn('[CrepeEditorManager] Cannot set markdown: Crepe not initialized')
      return
    }

    if (this.content === content) {
      return
    }

    if (this.isUpdatingContent) {
      return
    }

    this.isUpdatingContent = true
    this.content = content

    const startTime = performance.now()

    try {
      this.crepe.editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx)
          const parser = ctx.get(parserCtx)
          const doc = parser(content)

          if (!doc) {
            console.error('[CrepeEditorManager] Failed to parse markdown')
            return
          }

          const state = view.state
          const { from } = state.selection
          let tr = state.tr

          tr = tr.replace(
            0,
            state.doc.content.size,
            new Slice(doc.content, 0, 0)
          )

          const docSize = doc.content.size
          if (docSize <= 2) {
            tr = tr.setSelection(Selection.near(tr.doc.resolve(1)))
          } else {
            const safeFrom = Math.max(0, Math.min(from, docSize - 2))
            tr = tr.setSelection(Selection.near(tr.doc.resolve(safeFrom)))
          }
          view.dispatch(tr)
        } catch (innerError) {
          console.error('[CrepeEditorManager] Error updating editor:', innerError)
        }
      })

      if (this.currentTabId) {
        this.contentCache.set(this.currentTabId, content)
      }
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to set markdown:', error)
    } finally {
      this.isUpdatingContent = false
    }
  }

  getHTML(): string {
    if (!this.crepe || !this.isInitialized) {
      console.warn('[CrepeEditorManager] Cannot get HTML: Crepe not initialized')
      return ''
    }

    try {
      let html = ''
      this.crepe.editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx)
          if (view) {
            const dom = view.dom.querySelector('.milkdown')
            if (dom) {
              html = dom.innerHTML
            }
          }
        } catch (innerError) {
          console.error('[CrepeEditorManager] Failed to get editor view context:', innerError)
        }
      })
      return html
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to get HTML:', error)
      return ''
    }
  }

  setViewMode(mode: ViewMode): void {
    this.currentMode = mode

    if (this.currentTabId) {
      const tabsStore = useTabsStore()
      tabsStore.setViewMode(this.currentTabId, mode)
    }
  }

  getViewMode(): ViewMode {
    return this.currentMode
  }

  async switchToTab(tabId: string): Promise<void> {
    if (!this.crepe) {
      console.warn('[CrepeEditorManager] Cannot switch tab: Crepe not initialized')
      return
    }
    
    if (this.currentTabId === tabId) {
      return
    }

    const tabsStore = useTabsStore()
    const tab = tabsStore.tabs.get(tabId)

    if (!tab) {
      console.error(`[CrepeEditorManager] Tab not found: ${tabId}`)
      return
    }

    const previousTabId = this.currentTabId
    this.currentTabId = tabId
    this.currentMode = tab.viewMode

    if (tab.content !== this.content) {
      await this.setMarkdown(tab.content)
    } else {
      this.content = tab.content
    }

    eventBus.emit(AppEvents.TAB_SWITCHED, { tabId, previousTabId: previousTabId || undefined })
  }

  async destroy(): Promise<void> {
    if (this.crepe) {
      this.crepe.destroy()
      this.crepe = null
    }

    this.content = ''
    this.currentTabId = null
    this.container = null
    this.isInitialized = false
    this.cursorChangeHandler = null
    this.contentCache.clear()

    eventBus.emit(AppEvents.EDITOR_DESTROYED, { tabId: this.currentTabId })
  }

  isReady(): boolean {
    return this.isInitialized && this.crepe !== null
  }

  focus(): void {
    if (!this.crepe || !this.isInitialized) {
      return
    }
    
    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        view.focus()
      } catch (error) {
        console.error('[CrepeEditorManager] Failed to focus editor:', error)
      }
    })
  }

  scrollToHeading(text: string, line: number, pos?: number): void {
    if (!this.crepe || !this.isInitialized) return
    
    if (pos === undefined || pos < 0) {
      console.warn('[CrepeEditorManager] scrollToHeading: pos is required but not provided')
      return
    }

    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const targetPos = pos
        
        const resolvedPos = view.state.doc.resolve(targetPos)
        const tr = view.state.tr
          .setSelection(Selection.near(resolvedPos, 1))
          .scrollIntoView()
        
        view.dispatch(tr)
        view.focus()

        setTimeout(() => {
          try {
            const node = view.state.doc.nodeAt(targetPos)
            let targetElement: HTMLElement | null = null
            
            if (node) {
              const dom = view.nodeDOM(targetPos)
              if (dom instanceof HTMLElement) {
                targetElement = dom
              } else if (dom && dom.nodeType === Node.TEXT_NODE) {
                targetElement = (dom as Text).parentElement
              }
            }
            
            if (!targetElement) {
              const domResult = view.domAtPos(targetPos)
              if (domResult && domResult.node) {
                if (domResult.node.nodeType === Node.ELEMENT_NODE) {
                  const el = domResult.node as HTMLElement
                  if (el.tagName && /^H[1-6]$/.test(el.tagName)) {
                    targetElement = el
                  } else {
                    targetElement = el.closest('h1, h2, h3, h4, h5, h6')
                  }
                } else {
                  targetElement = (domResult.node as Text).parentElement?.closest('h1, h2, h3, h4, h5, h6') || null
                }
              }
            }
            
            if (!targetElement) return
            
            let scrollContainer: HTMLElement | null = targetElement.closest('.editor-wysiwyg, .editor-split-preview')
            
            if (!scrollContainer) {
              scrollContainer = view.dom.parentElement?.closest('.editor-wysiwyg, .editor-split-preview') || null
            }
            
            if (!scrollContainer) return
            
            const elementRect = targetElement.getBoundingClientRect()
            const containerRect = scrollContainer.getBoundingClientRect()
            
            const scrollTop = scrollContainer.scrollTop
            const relativeTop = elementRect.top - containerRect.top
            const targetScrollTop = scrollTop + relativeTop - 20
            
            scrollContainer.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            })
          } catch (scrollError) {
            console.error('[CrepeEditorManager] Smooth scroll error:', scrollError)
          }
        }, 50)

        const { from, to } = view.state.selection
        this.emitCursorChange(from, to)
      } catch (error) {
        console.error('[CrepeEditorManager] scrollToHeading error:', error)
      }
    })
  }

  getCurrentCursorLine(): number {
    if (!this.crepe || !this.isInitialized) return 0

    let line = 0
    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const { from } = view.state.selection
        const text = view.state.doc.textBetween(0, from)
        line = text.split('\n').length
      } catch {
        line = 0
      }
    })
    return line
  }

  getHeadingsWithPos(): HeadingItem[] {
    if (!this.crepe || !this.isInitialized) return []
    
    const headings: HeadingItem[] = []
    
    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const doc = view.state.doc
        
        doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            const text = node.textContent.trim()
            const level = node.attrs.level || 1
            
            const textBefore = doc.textBetween(0, pos)
            const line = textBefore.split('\n').length
            
            headings.push({
              text,
              level,
              slug: generateSlug(text),
              line,
              pos
            })
          }
        })
      } catch (error) {
        console.error('[CrepeEditorManager] Failed to get headings with pos:', error)
      }
    })
    
    return headings
  }

  private emitCursorChange(from: number, to: number): void {
    if (this.currentTabId) {
      eventBus.emit(AppEvents.CURSOR_CHANGED, {
        from,
        to,
        tabId: this.currentTabId,
      })
    }
    this.cursorChangeHandler?.(from, to)
  }

  private handleMarkdownUpdate(markdown: string): void {
    if (this.isUpdatingContent) {
      return
    }

    if (this.content === markdown) {
      return
    }

    if (this.activeEditor === 'codemirror') {
      return
    }

    this.content = markdown

    if (this.currentTabId) {
      const tabsStore = useTabsStore()
      tabsStore.updateTab(this.currentTabId, {
        content: markdown,
        isDirty: true,
        lastModified: Date.now(),
      })

      this.contentCache.set(this.currentTabId, markdown)
    }

    eventBus.emit(AppEvents.CONTENT_CHANGED, {
      content: markdown,
      tabId: this.currentTabId || '',
    })
  }

  getCachedContent(tabId: string): string | undefined {
    return this.contentCache.get(tabId)
  }

  setCachedContent(tabId: string, content: string): void {
    this.contentCache.set(tabId, content)
  }

  clearCache(): void {
    this.contentCache.clear()
  }

  private isDarkMode(): boolean {
    const preferences = usePreferencesStore()
    const effectiveTheme = preferences.theme === 'system'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')
      : preferences.theme
    return effectiveTheme === 'dark'
  }

  async updateTheme(): Promise<void> {
    if (!this.crepe || !this.isInitialized || !this.container) {
      console.warn('[CrepeEditorManager] Cannot update theme: Crepe not initialized')
      return
    }
    
    const currentContent = this.getMarkdown()
    const container = this.container
    const tabId = this.currentTabId
    
    await this.destroy()
    await this.init(container, currentContent, tabId || undefined)
  }

  search(query: { search: string; caseSensitive?: boolean; wholeWord?: boolean; regexp?: boolean }) {
    return this.searchManager.search(query)
  }

  clearSearch(): void {
    this.searchManager.clearSearch()
  }

  findNext() {
    return this.searchManager.findNext()
  }

  findPrev() {
    return this.searchManager.findPrev()
  }

  replaceNext(replacement: string) {
    return this.searchManager.replaceNext(replacement)
  }

  replaceAll(replacement: string) {
    return this.searchManager.replaceAll(replacement)
  }

  insertImage(imageUrl: string, altText: string): void {
    if (!this.crepe || !this.isInitialized) {
      console.warn('[CrepeEditorManager] Cannot insert image: Crepe not initialized')
      return
    }

    try {
      const imageMarkdown = `![${altText || 'image'}](${imageUrl})`
      this.crepe.editor.action(insert(imageMarkdown, true))
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to insert image:', error)
    }
  }

  undo(): void {
    if (!this.crepe || !this.isInitialized) {
      return
    }

    try {
      this.crepe.editor.action(callCommand(undoCommand.key))
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to undo:', error)
    }
  }

  redo(): void {
    if (!this.crepe || !this.isInitialized) {
      return
    }

    try {
      this.crepe.editor.action(callCommand(redoCommand.key))
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to redo:', error)
    }
  }
}

let crepeEditorManagerInstance: CrepeEditorManager | null = null

export function useCrepeEditorManager(): CrepeEditorManager {
  if (!crepeEditorManagerInstance) {
    crepeEditorManagerInstance = new CrepeEditorManager()
  }
  return crepeEditorManagerInstance
}

export function resetCrepeEditorManager(): void {
  if (crepeEditorManagerInstance) {
    crepeEditorManagerInstance.destroy()
    crepeEditorManagerInstance = null
  }
}

export function useEditorSearch() {
  const searchManager = useEditorSearchManager()
  
  function setSearchHighlight(config: { search: string; caseSensitive?: boolean; wholeWord?: boolean; regexp?: boolean }) {
    if (config.search) {
      return searchManager.search(config)
    } else {
      searchManager.clearSearch()
      return { current: 0, total: 0 }
    }
  }
  
  function clearSearchHighlight() {
    searchManager.clearSearch()
  }

  function findNextMatch() {
    return searchManager.findNext()
  }

  function findPrevMatch() {
    return searchManager.findPrev()
  }

  function replaceNextMatch(replacement: string) {
    return searchManager.replaceNext(replacement)
  }

  function replaceAllMatches(replacement: string) {
    return searchManager.replaceAll(replacement)
  }
  
  return {
    setSearchHighlight,
    clearSearchHighlight,
    findNextMatch,
    findPrevMatch,
    replaceNextMatch,
    replaceAllMatches
  }
}
