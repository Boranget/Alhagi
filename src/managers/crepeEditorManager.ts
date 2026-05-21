import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Slice } from '@milkdown/kit/prose/model'
import { Selection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import { nord } from '@uiw/codemirror-theme-nord'
import type { ViewMode } from '@/types'
import type { HeadingItem } from '@/utils/headings'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { LRUCache } from '@/utils/performance'
import { debounce } from '@/utils/helpers'
import { generateSlug } from '@/utils/headings'

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

  constructor() {
    this.contentCache = new LRUCache<string>(20)
  }

setActiveEditor(editor: 'crepe' | 'codemirror' | null): void {
    this.activeEditor = editor
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.activeEditor
  }

  /**
   * 注册光标变化回调，供大纲组件使用
   */
  onCursorChange(handler: (from: number, to: number) => void): void {
    this.cursorChangeHandler = handler
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    if (!container) {
      console.error('[CrepeEditorManager] Container is undefined, cannot initialize')
      return
    }

    const startTime = performance.now()

    this.content = initialContent
    this.currentTabId = tabId || null
    this.container = container

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

        // 监听编辑器更新（包括光标/选区变化）
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

    try {
      await this.crepe.create()
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
          const safeFrom = Math.min(from, docSize - 2)
          tr = tr.setSelection(Selection.near(tr.doc.resolve(safeFrom)))
          view.dispatch(tr)
        } catch (innerError) {
          console.error('[CrepeEditorManager] Error updating editor:', innerError)
        }
      })

      const setTime = performance.now() - startTime

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

  /**
   * 在 ProseMirror/WYSIWYG 编辑器中滚动到指定标题
   * 
   * 实现原理（参考 MarkText/Typora）：
   * 1. 直接使用 ProseMirror 节点位置（pos）定位
   * 2. 通过 ProseMirror 的 nodeDOM API 找到标题对应的 DOM 元素
   * 3. 定位到真正的滚动容器（.wysiwyg-editor 或 .split-preview）
   * 4. 计算标题相对于滚动容器的位置
   * 5. 使用 scrollTo 执行平滑滚动
   * 
   * @param text - 标题文本内容（仅用于日志，不参与定位）
   * @param line - 标题所在行号（仅用于日志，不参与定位）
   * @param pos - ProseMirror 节点位置（必需，用于精确定位）
   */
  scrollToHeading(text: string, line: number, pos?: number): void {
    if (!this.crepe || !this.isInitialized) return
    
    // pos 是必需的，如果没有提供则无法定位
    if (pos === undefined || pos < 0) {
      console.warn('[CrepeEditorManager] scrollToHeading: pos is required but not provided')
      return
    }

    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const targetPos = pos
        
        // 直接使用 pos 进行定位
        const resolvedPos = view.state.doc.resolve(targetPos)
        // 关键：在 transaction 上调用 scrollIntoView()，让 ProseMirror 知道需要滚动
        const tr = view.state.tr
          .setSelection(Selection.near(resolvedPos, 1))
          .scrollIntoView()
        
        view.dispatch(tr)
        view.focus()

        // 延迟执行 DOM 滚动，确保 ProseMirror 已更新 DOM
        setTimeout(() => {
          try {
            // 步骤 1: 获取标题对应的 DOM 元素
            // 优先使用 ProseMirror 的 nodeDOM API，它返回节点对应的真实 DOM
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
            
            // 备用方案：如果 nodeDOM 失败，通过 domAtPos 查找最近的 heading 元素
            if (!targetElement) {
              const domResult = view.domAtPos(targetPos)
              if (domResult && domResult.node) {
                if (domResult.node.nodeType === Node.ELEMENT_NODE) {
                  const el = domResult.node as HTMLElement
                  // 如果直接就是 heading 元素
                  if (el.tagName && /^H[1-6]$/.test(el.tagName)) {
                    targetElement = el
                  } else {
                    // 否则向上查找最近的 heading 父元素
                    targetElement = el.closest('h1, h2, h3, h4, h5, h6')
                  }
                } else {
                  // 文本节点，向上查找 heading
                  targetElement = (domResult.node as Text).parentElement?.closest('h1, h2, h3, h4, h5, h6') || null
                }
              }
            }
            
            if (!targetElement) return
            
            // 步骤 2: 找到真正的滚动容器
            // 注意：必须是具有 overflow: auto/scroll 的容器，而不是任意父元素
            let scrollContainer: HTMLElement | null = targetElement.closest('.wysiwyg-editor, .split-preview')
            
            // 如果没找到，尝试从 view.dom 向上查找
            if (!scrollContainer) {
              scrollContainer = view.dom.parentElement?.closest('.wysiwyg-editor, .split-preview') || null
            }
            
            if (!scrollContainer) return
            
            // 步骤 3: 计算滚动位置
            // 使用 getBoundingClientRect 获取相对于视口的位置，避免受 CSS transform 影响
            const elementRect = targetElement.getBoundingClientRect()
            const containerRect = scrollContainer.getBoundingClientRect()
            
            // 计算公式：
            // relativeTop = 标题相对于视口的位置 - 容器相对于视口的位置
            //             = 标题相对于容器顶部的位置
            // targetScrollTop = 当前滚动位置 + 相对位置 - 边距
            const scrollTop = scrollContainer.scrollTop
            const relativeTop = elementRect.top - containerRect.top
            const targetScrollTop = scrollTop + relativeTop - 20 // 留 20px 边距，让标题不紧贴顶部
            
            // 步骤 4: 执行平滑滚动
            // 使用 Math.max(0, ...) 确保滚动位置不为负数
            scrollContainer.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            })
          } catch (scrollError) {
            console.error('[CrepeEditorManager] Smooth scroll error:', scrollError)
          }
        }, 50)

        // 额外触发一次光标变化通知，更新大纲高亮状态
        const { from, to } = view.state.selection
        this.emitCursorChange(from, to)
      } catch (error) {
        console.error('[CrepeEditorManager] scrollToHeading error:', error)
      }
    })
  }

  /**
   * 获取当前光标在 WYSIWYG 编辑器中所在的行号（相对于整个文档文本）
   */
  getCurrentCursorLine(): number {
    if (!this.crepe || !this.isInitialized) return 0

    let line = 0
    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const { from } = view.state.selection
        // 通过内容文本计算行号
        const text = view.state.doc.textBetween(0, from)
        line = text.split('\n').length
      } catch {
        line = 0
      }
    })
    return line
  }

  /**
   * 从 ProseMirror 文档中获取所有标题及其节点位置
   * 
   * @returns 包含 pos 信息的标题列表
   */
  getHeadingsWithPos(): HeadingItem[] {
    if (!this.crepe || !this.isInitialized) return []
    
    const headings: HeadingItem[] = []
    
    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const doc = view.state.doc
        
        // 遍历 ProseMirror 文档查找所有标题节点
        doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            const text = node.textContent.trim()
            const level = node.attrs.level || 1
            
            // 计算行号（通过统计之前的换行符）
            const textBefore = doc.textBetween(0, pos)
            const line = textBefore.split('\n').length
            
            headings.push({
              text,
              level,
              slug: generateSlug(text),
              line,
              pos  // 存储 ProseMirror 节点位置
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
    // Crepe 还没有内置的搜索高亮 API
  }
  
  function clearSearchHighlight() {
    // 清除搜索高亮
  }
  
  return {
    setSearchHighlight,
    clearSearchHighlight
  }
}