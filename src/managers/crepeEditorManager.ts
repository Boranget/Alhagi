import { Crepe } from '@milkdown/crepe'
import { editorStateCtx, editorViewCtx, parserCtx } from '@milkdown/kit/core'
import { InitReady, remarkPluginsCtx, remarkStringifyOptionsCtx } from '@milkdown/core'
import type { MilkdownPlugin } from '@milkdown/ctx'
import { insert, $prose, callCommand } from '@milkdown/kit/utils'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Slice } from '@milkdown/kit/prose/model'
import { Selection } from '@milkdown/kit/prose/state'
import { Plugin } from '@milkdown/kit/prose/state'
import { undoCommand, redoCommand } from '@milkdown/plugin-history'
import {
  toggleEmphasisCommand,
  toggleStrongCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  wrapInHeadingCommand,
  createCodeBlockCommand,
} from '@milkdown/preset-commonmark'
import {
  insertTableCommand,
  toggleStrikethroughCommand,
} from '@milkdown/preset-gfm'
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import { resolveImageToDisplayUrl, debounce } from '@/utils/helpers'
import type { ViewMode } from '@/types'
import type { HeadingItem } from '@/utils/headings'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { LRUCache } from '@/utils/performance'
import { generateSlug } from '@/utils/headings'
import {
  insertTableRowAbove,
  insertTableRowBelow,
  deleteTableRow,
  insertTableColumnLeft,
  insertTableColumnRight,
  deleteTableColumn,
} from '@/commands/tableCommands'
import { useEditorSearchManager, getSearchPlugin } from '@/managers/EditorSearchManager'
import { focusModePlugin } from '@/plugins/focusModePlugin'
import { inlineMarksPlugin, toggleHighlightCommand } from '@/plugins/inlineMarksPlugin'
import remarkHighlight from '@/plugins/remarkHighlight'
import remarkSuperSub from '@/plugins/remarkSuperSub'
import type { EditorView } from '@milkdown/kit/prose/view'

const imagePathPlugin = $prose(() => new Plugin({
  view(editorView: EditorView) {
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

/**
 * MilkdownPlugin: 注册 remark 解析插件，将 ==text== / ^text^ / ~text~ 解析为 AST 节点
 */
const inlineMarksParsersPlugin: MilkdownPlugin = (ctx) => async () => {
  await ctx.wait(InitReady)
  ctx.update(remarkPluginsCtx, (rp) => [
    ...rp,
    { plugin: remarkHighlight, options: {} },
    { plugin: remarkSuperSub, options: {} },
  ])
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
  private editorView: EditorView | null = null  // 保存 EditorView 引用
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

  /**
   * 获取 ProseMirror EditorView 实例
   * 用于打字机模式等需要访问编辑器 DOM 的场景
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEditorView(): any {
    return this.editorView
  }

  /**
   * 获取编辑器滚动容器
   */
  getContainer(): HTMLElement | null {
    return this.container
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    console.log('[CrepeEditorManager] init 开始执行', {
      container,
      containerExists: !!container,
      initialContentLength: initialContent?.length,
      tabId
    })
    
    if (!container) {
      console.error('[CrepeEditorManager] init 失败：container 为空')
      return
    }

    const startTime = performance.now()
    console.log('[CrepeEditorManager] 开始初始化...')

    this.currentTabId = tabId || null
    this.container = container
    this.content = initialContent

    const isDark = this.isDarkMode()
    console.log('[CrepeEditorManager] 暗黑模式：', isDark)
    
    console.log('[CrepeEditorManager] 正在创建 Crepe 实例...')
    try {
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
          [Crepe.Feature.ImageBlock]: false,
          [Crepe.Feature.ImageInline]: false,
        },
        featureConfigs: {
          [Crepe.Feature.CodeMirror]: {
            theme: isDark ? undefined : eclipse,
          },
        },
      })
      console.log('[CrepeEditorManager] Crepe 实例创建成功')
    } catch (error) {
      console.error('[CrepeEditorManager] Crepe 实例创建失败:', error)
      throw error
    }

    console.log('[CrepeEditorManager] 正在配置插件...')
    try {
      this.crepe.editor
        .config((ctx) => {
          console.log('[CrepeEditorManager] config 回调执行中')
          
          ctx.get(listenerCtx).markdownUpdated(
            debounce((...args: unknown[]) => {
              const markdown = args[1] as string
              this.handleMarkdownUpdate(markdown)
            }, 200)
          )

          ctx.get(listenerCtx).updated((ctx) => {
            try {
              const view = ctx.get(editorViewCtx)
              this.editorView = view  // 保存 EditorView 引用
              const { from, to } = view.state.selection
              this.emitCursorChange(from, to)
            } catch {
              // 初始化时可能还拿不到 view
            }
          })

          // 配置 remark stringify handlers，使 highlight/superscript/subscript 正确序列化为 markdown 语法
          ctx.update(remarkStringifyOptionsCtx, (options) => ({
            ...options,
            handlers: {
              ...options.handlers,
              highlight: (node: Record<string, unknown>, _parent: unknown, state: { containerPhrasing: (node: Record<string, unknown>, info: Record<string, string>) => string }, info: Record<string, string>) => {
                const value = state.containerPhrasing(node, { ...info, before: '=', after: '=' })
                return `==${value}==`
              },
              superscript: (node: Record<string, unknown>, _parent: unknown, state: { containerPhrasing: (node: Record<string, unknown>, info: Record<string, string>) => string }, info: Record<string, string>) => {
                const value = state.containerPhrasing(node, { ...info, before: '^', after: '^' })
                return `^${value}^`
              },
              subscript: (node: Record<string, unknown>, _parent: unknown, state: { containerPhrasing: (node: Record<string, unknown>, info: Record<string, string>) => string }, info: Record<string, string>) => {
                const value = state.containerPhrasing(node, { ...info, before: '~', after: '~' })
                return `~${value}~`
              },
            },
          }))
        })
        .use(listener)
        .use(getSearchPlugin())
        .use(imagePathPlugin)
        .use(focusModePlugin)
        .use(inlineMarksPlugin)
        .use(inlineMarksParsersPlugin)
    } catch (error) {
      console.error('[CrepeEditorManager] 配置插件失败:', error)
      throw error
    }

    console.log('[CrepeEditorManager] 正在调用 create()...')
    try {
      await this.crepe.create()
      console.log('[CrepeEditorManager] crepe.create() 执行成功')
    } catch (error) {
      console.error('[CrepeEditorManager] crepe.create() 失败:', error)
      throw error
    }
    
    this.searchManager.init(this.crepe.editor)
    this.isInitialized = true

    const initTime = performance.now() - startTime
    console.log(`[CrepeEditorManager] 初始化完成，耗时 ${initTime.toFixed(2)}ms`)

    if (this.currentTabId) {
      eventBus.emit(AppEvents.EDITOR_READY, { tabId: this.currentTabId })
    } else {
      eventBus.emit(AppEvents.EDITOR_READY, { tabId: null })
    }
  }

  getMarkdown(): string {
    if (!this.crepe || !this.isInitialized) {
      return this.content
    }

    try {
      const markdown = this.crepe.getMarkdown()
      return markdown || this.content
    } catch (error) {
      return this.content
    }
  }

  async setMarkdown(content: string): Promise<void> {
    if (!this.crepe) {
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

    try {
      this.crepe.editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx)
          const parser = ctx.get(parserCtx)
          const doc = parser(content)

          if (!doc) {
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
          // Silent fail - ignore selection reset errors
        }
      })

      if (this.currentTabId) {
        this.contentCache.set(this.currentTabId, content)
      }
    } catch (error) {
      // Silent fail - content update errors
    } finally {
      this.isUpdatingContent = false
    }
  }

  getHTML(): string {
    if (!this.crepe || !this.isInitialized) {
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
          // Silent fail - ignore inner errors
        }
      })
      return html
    } catch (error) {
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
      return
    }
    
    if (this.currentTabId === tabId) {
      return
    }

    const tabsStore = useTabsStore()
    const tab = tabsStore.tabs.get(tabId)

    if (!tab) {
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
        // Silent fail - ignore focus errors
      }
    })
  }

  scrollToHeading(text: string, line: number, pos?: number): void {
    if (!this.crepe || !this.isInitialized) return
    
    if (pos === undefined || pos < 0) {
      return
    }

    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        if (!view || !view.state) {
          return
        }
        const targetPos = pos
        
        const resolvedPos = view.state.doc.resolve(targetPos)
        const tr = view.state.tr
          .setSelection(Selection.near(resolvedPos, 1))
          .scrollIntoView()
        
        view.dispatch(tr)
        view.focus()

        setTimeout(() => {
          try {
            if (!view.state) return
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
            // Silent fail - scroll errors
          }
        }, 50)

        const { from, to } = view.state.selection
        this.emitCursorChange(from, to)
      } catch (error) {
        // Silent fail - scroll navigation errors
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
        if (!view || !view.state) {
          return
        }
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
        // Silent fail - heading extraction errors
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
      return
    }

    try {
      const imageMarkdown = `![${altText || 'image'}](${imageUrl})`
      this.crepe.editor.action(insert(imageMarkdown, true))
    } catch (error) {
      // Silent fail - image insertion errors
    }
  }

  undo(): void {
    if (!this.crepe || !this.isInitialized) {
      return
    }

    try {
      this.crepe.editor.action(callCommand(undoCommand.key))
    } catch (error) {
      // Silent fail - undo errors
    }
  }

  redo(): void {
    if (!this.crepe || !this.isInitialized) {
      return
    }

    try {
      this.crepe.editor.action(callCommand(redoCommand.key))
    } catch (error) {
      // Silent fail - redo errors
    }
  }

  toggleBold(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleStrongCommand.key))
    } catch (error) {
      // Silent fail - bold toggle errors
    }
  }

  toggleItalic(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleEmphasisCommand.key))
    } catch (error) {
      // Silent fail - italic toggle errors
    }
  }

  toggleStrikethrough(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleStrikethroughCommand.key))
    } catch (error) {
      // Silent fail - strikethrough toggle errors
    }
  }

  toggleInlineCode(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleInlineCodeCommand.key))
    } catch (error) {
      // Silent fail - inline code toggle errors
    }
  }

  toggleLink(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleLinkCommand.key))
    } catch (error) {
      // Silent fail - link toggle errors
    }
  }

  toggleHeading(level: number): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInHeadingCommand.key, level))
    } catch (error) {
      // Silent fail - heading toggle errors
    }
  }

  toggleParagraph(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      // 使用 wrapInHeadingCommand，level 0 表示切换到普通段落
      this.crepe.editor.action(callCommand(wrapInHeadingCommand.key, 0))
    } catch (error) {
      console.error('[CrepeEditorManager] toggleParagraph failed:', error)
    }
  }

  toggleHighlight(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleHighlightCommand.key))
    } catch (error) {
      // Silent fail - highlight toggle errors
    }
  }

  toggleBulletList(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInBulletListCommand.key))
    } catch (error) {
      // Silent fail - bullet list toggle errors
    }
  }

  toggleOrderedList(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInOrderedListCommand.key))
    } catch (error) {
      // Silent fail - ordered list toggle errors
    }
  }

  toggleTaskList(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInBulletListCommand.key))
    } catch (error) {
      // Silent fail - task list toggle errors
    }
  }

  toggleBlockQuote(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInBlockquoteCommand.key))
    } catch (error) {
      // Silent fail - block quote toggle errors
    }
  }

  toggleCodeBlock(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(createCodeBlockCommand.key))
    } catch (error) {
      // Silent fail - code block toggle errors
    }
  }

  toggleCodeFence(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(createCodeBlockCommand.key))
    } catch (error) {
      // Silent fail - code fence toggle errors
    }
  }

  insertCodeBlock(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(createCodeBlockCommand.key))
    } catch (error) {
      // Silent fail - code block insertion errors
    }
  }

  insertMathBlock(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(insert('\n$$\n\n$$\n', true))
    } catch (error) {
      // Silent fail - math block insertion errors
    }
  }

  insertHorizontalRule(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(insert('\n---\n', true))
    } catch (error) {
      // Silent fail - horizontal rule insertion errors
    }
  }

  insertTable(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(insertTableCommand.key))
    } catch (error) {
      // Silent fail - table insertion errors
    }
  }

  insertTableRowAbove(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        insertTableRowAbove(state, view)
      })
    } catch (error) {
      // Silent fail - table operation may not be applicable
    }
  }

  insertTableRowBelow(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        insertTableRowBelow(state, view)
      })
    } catch (error) {
      // Silent fail - table operation may not be applicable
    }
  }

  deleteTableRow(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        deleteTableRow(state, view)
      })
    } catch (error) {
      // Silent fail - table operation may not be applicable
    }
  }

  insertTableColumnLeft(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        insertTableColumnLeft(state, view)
      })
    } catch (error) {
      // Silent fail - table operation may not be applicable
    }
  }

  insertTableColumnRight(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        insertTableColumnRight(state, view)
      })
    } catch (error) {
      // Silent fail - table operation may not be applicable
    }
  }

  deleteTableColumn(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        deleteTableColumn(state, view)
      })
    } catch (error) {
      // Silent fail - table operation may not be applicable
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
