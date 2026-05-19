import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Slice } from '@milkdown/kit/prose/model'
import { Selection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import type { ViewMode } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'
import { LRUCache } from '@/utils/performance'
import { debounce } from '@/utils/helpers'

export class CrepeEditorManager {
  private crepe: Crepe | null = null
  private content: string = ''
  private currentTabId: string | null = null
  private currentMode: ViewMode = 'wysiwyg'
  private contentCache: LRUCache<string>
  private isUpdatingContent = false
  private isInitialized = false
  private activeEditor: 'crepe' | 'codemirror' | null = null

  constructor() {
    this.contentCache = new LRUCache<string>(20)
  }

  setActiveEditor(editor: 'crepe' | 'codemirror' | null): void {
    this.activeEditor = editor
    console.log('[CrepeEditorManager] Active editor set to:', editor)
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    console.log('[CrepeEditorManager] init() called')
    console.log('[CrepeEditorManager] container:', container)
    console.log('[CrepeEditorManager] initialContent length:', initialContent.length)
    console.log('[CrepeEditorManager] isInitialized:', this.isInitialized)
    
    // 如果已经初始化，先销毁旧的实例
    if (this.isInitialized && this.crepe) {
      console.log('[CrepeEditorManager] Already initialized, destroying old instance first')
      await this.destroy()
    }

    const startTime = performance.now()
    console.log('[CrepeEditorManager] Initializing with content length:', initialContent.length)

    this.content = initialContent
    this.currentTabId = tabId || null

    console.log('[CrepeEditorManager] Creating Crepe instance...')
    this.crepe = new Crepe({
      root: container,
      defaultValue: initialContent,
      features: {
        [Crepe.Feature.BlockEdit]: true,
        [Crepe.Feature.CodeMirror]: true, // LaTeX 功能需要启用 CodeMirror
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.Placeholder]: true,
      },
    })
    console.log('[CrepeEditorManager] Crepe instance created')

    console.log('[CrepeEditorManager] Configuring editor...')
    this.crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(
          debounce((...args: unknown[]) => {
            const markdown = args[1] as string
            this.handleMarkdownUpdate(markdown)
          }, 200)
        )
      })
      .use(listener)
    console.log('[CrepeEditorManager] Editor configured')

    console.log('[CrepeEditorManager] Calling crepe.create()...')
    try {
      await this.crepe.create()
      console.log('[CrepeEditorManager] crepe.create() completed successfully')
    } catch (error) {
      console.error('[CrepeEditorManager] crepe.create() failed:', error)
      throw error
    }

    this.isInitialized = true
    const initTime = performance.now() - startTime
    console.log(`[CrepeEditorManager] Initialized in ${initTime.toFixed(2)}ms`)
    console.log('[CrepeEditorManager] Editor DOM:', container.innerHTML.substring(0, 200))

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
      console.log('[CrepeEditorManager] Skipping setMarkdown: already updating content')
      return
    }

    this.isUpdatingContent = true
    this.content = content

    const startTime = performance.now()

    try {
      // 使用 Crepe 的内置方法更安全
      // 我们可以用 Crepe 的 API 或者更安全的方式处理
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
          const safeFrom = Math.min(from, docSize - 2)
          tr = tr.setSelection(Selection.near(tr.doc.resolve(safeFrom)))
          view.dispatch(tr)
        } catch (innerError) {
          console.error('[CrepeEditorManager] Error updating editor:', innerError)
        }
      })

      const setTime = performance.now() - startTime
      console.log(`[CrepeEditorManager] Set markdown in ${setTime.toFixed(2)}ms`)

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

    console.log(`[CrepeEditorManager] View mode changed to: ${mode}`)
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
      console.log('[CrepeEditorManager] Already on tab:', tabId)
      return
    }

    const tabsStore = useTabsStore()
    const tab = tabsStore.tabs.get(tabId)

    if (!tab) {
      console.error(`[CrepeEditorManager] Tab not found: ${tabId}`)
      return
    }

    console.log(`[CrepeEditorManager] Switching to tab: ${tabId}`)
    console.log(`[CrepeEditorManager] Tab content length: ${tab.content.length}`)
    console.log(`[CrepeEditorManager] Current content length: ${this.content.length}`)

    const previousTabId = this.currentTabId
    this.currentTabId = tabId
    this.currentMode = tab.viewMode

    if (tab.content !== this.content) {
      console.log(`[CrepeEditorManager] Content differs, calling setMarkdown`)
      await this.setMarkdown(tab.content)
    } else {
      console.log(`[CrepeEditorManager] Content same, not calling setMarkdown`)
      this.content = tab.content
    }

    eventBus.emit(AppEvents.TAB_SWITCHED, { tabId, previousTabId: previousTabId || undefined })
  }

  async destroy(): Promise<void> {
    console.log('[CrepeEditorManager] Destroying...')
    console.trace('[CrepeEditorManager] Destroy call stack:')

    if (this.crepe) {
      this.crepe.destroy()
      this.crepe = null
    }

    this.content = ''
    this.currentTabId = null
    this.isInitialized = false
    this.contentCache.clear()

    eventBus.emit(AppEvents.EDITOR_DESTROYED, { tabId: this.currentTabId })

    console.log('[CrepeEditorManager] Destroyed')
  }

  isReady(): boolean {
    return this.isInitialized && this.crepe !== null
  }

  private handleMarkdownUpdate(markdown: string): void {
    if (this.isUpdatingContent) {
      return
    }

    if (this.content === markdown) {
      return
    }

    console.log('[CrepeEditorManager] Content updated, length:', markdown.length)
    console.log('[CrepeEditorManager] Current view mode:', this.currentMode)
    console.log('[CrepeEditorManager] Active editor:', this.activeEditor)

    // 如果当前用户正在编辑 CodeMirror，就不应该由 Crepe 更新
    if (this.activeEditor === 'codemirror') {
      console.log('[CrepeEditorManager] CodeMirror is active, skipping content update from Crepe')
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

// 搜索高亮相关功能
export function useEditorSearch() {
  const editorManager = useCrepeEditorManager()
  
  function setSearchHighlight(config: { search: string; caseSensitive?: boolean; wholeWord?: boolean; regexp?: boolean }) {
    console.log('[CrepeEditorManager] setSearchHighlight called with:', config)
    // Crepe 还没有内置的搜索高亮 API，这里先记录日志
    // 后续可以通过 ProseMirror 的 decorations 实现
  }
  
  function clearSearchHighlight() {
    console.log('[CrepeEditorManager] clearSearchHighlight called')
    // 清除搜索高亮
  }
  
  return {
    setSearchHighlight,
    clearSearchHighlight
  }
}
