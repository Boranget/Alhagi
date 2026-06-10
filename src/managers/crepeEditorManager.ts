import { Crepe } from '@milkdown/crepe'
import { editorViewCtx, parserCtx } from '@milkdown/kit/core'
import { InitReady, remarkPluginsCtx, remarkStringifyOptionsCtx } from '@milkdown/core'
import type { MilkdownPlugin } from '@milkdown/ctx'
import { $prose } from '@milkdown/kit/utils'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Slice } from '@milkdown/kit/prose/model'
import { Selection } from '@milkdown/kit/prose/state'
import { Plugin } from '@milkdown/kit/prose/state'
import { EditorStateManager } from './EditorStateManager'
import { EditorCommands } from './EditorCommands'
import { resolveImageToDisplayUrl, debounce } from '@/utils/helpers'
import type { ViewMode } from '@/types'
import type { HeadingItem } from '@/utils/headings'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { LRUCache } from '@/utils/performance'
import { generateSlug } from '@/utils/headings'
import { useEditorSearchManager, getSearchPlugin } from '@/managers/EditorSearchManager'
import { focusModePlugin } from '@/plugins/focusModePlugin'
import { inlineMarksPlugin } from '@/plugins/inlineMarksPlugin'
import { taskListPlugin } from '@/plugins/taskListPlugin'
import remarkHighlight from '@/plugins/remarkHighlight'
import remarkSuperSub from '@/plugins/remarkSuperSub'
import { remarkFrontmatterToCode, convertFrontmatterToCodeBlock, convertCodeBlockToFrontmatter } from '@/plugins/frontmatter'
import remarkFrontmatter from 'remark-frontmatter'
import type { EditorView } from '@milkdown/kit/prose/view'
import { createCustomCodeMirrorPlugin } from '@/components/Editor/codemirror/customCodeMirrorPlugin'
import { codeBlockConfig } from '@milkdown/kit/component/code-block'

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

/**
 * MilkdownPlugin: 注册 remark-frontmatter 和转换插件，
 * 将文档开头的 YAML frontmatter 解析为 yaml 代码块显示。
 * 注意：remark-frontmatter 必须在 remarkFrontmatterToCode 之前执行。
 *
 * remark-frontmatter 的 options 类型（Matter|Preset[]）与 Milkdown 的
 * `RemarkPlugin<Record<string, unknown>>` 不严格兼容，这里用 cast 绕过——
 * 运行时是 remark/unified 统一接受的 plugin 形态。
 */
const frontmatterPlugin: MilkdownPlugin = (ctx) => async () => {
  await ctx.wait(InitReady)
  ctx.update(remarkPluginsCtx, (rp) => [
    ...rp,
    { plugin: remarkFrontmatter, options: { type: 'yaml', marker: '-' } },
    { plugin: remarkFrontmatterToCode, options: {} },
  ] as typeof rp)
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
  private editorView: EditorView | null = null
  private cursorChangeHandler: ((from: number, to: number) => void) | null = null
  private searchManager = useEditorSearchManager()
  private stateManager = new EditorStateManager()
  private commands = new EditorCommands()

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

    console.log('[CrepeEditorManager] 正在创建 Crepe 实例...')
    try {
      this.crepe = new Crepe({
        root: container,
        defaultValue: initialContent,
        features: {
          [Crepe.Feature.BlockEdit]: false,
          [Crepe.Feature.CodeMirror]: false, // 禁用默认的 CodeMirror 功能
          [Crepe.Feature.LinkTooltip]: true,
          [Crepe.Feature.Table]: true,
          [Crepe.Feature.Toolbar]: false,
          [Crepe.Feature.Placeholder]: true,
          [Crepe.Feature.Cursor]: false,
          [Crepe.Feature.ImageBlock]: false,
          [Crepe.Feature.Latex]: false,
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
              this.editorView = view
              this.stateManager.attach(view)
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
        .use(taskListPlugin)
        .use(inlineMarksParsersPlugin)
        .use(frontmatterPlugin)
        .use(codeBlockConfig) // 注册 codeBlockConfig ctx（CodeMirror view 由自定义插件提供）
        .use(createCustomCodeMirrorPlugin()) // 使用自定义 CodeMirror 插件
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
    
    this.commands.setCrepe(this.crepe)
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
      // 将 yaml 代码块转回 frontmatter 格式（用于保存到文件）
      const result = convertCodeBlockToFrontmatter(markdown || this.content)
      return result
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

    // 将 frontmatter 转换为 yaml 代码块后再解析
    const convertedContent = convertFrontmatterToCodeBlock(content)

    try {
      this.crepe.editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx)
          const parser = ctx.get(parserCtx)
          const doc = parser(convertedContent)

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
    
    // 在切换前保存当前状态
    if (previousTabId && this.isInitialized) {
      const currentState = this.getCurrentEditorState()
      const prevTab = tabsStore.getTab(previousTabId)
      if (prevTab) {
        tabsStore.updateTab(previousTabId, {
          crepe: {
            ...prevTab.crepe,
            cursor: currentState.cursor || prevTab.crepe.cursor,
            scrollTop: currentState.scrollTop !== undefined ? currentState.scrollTop : prevTab.crepe.scrollTop
          }
        })
      }
    }

    this.currentTabId = tabId
    this.currentMode = tab.viewMode

    if (tab.content !== this.content) {
      await this.setMarkdown(tab.content)
    } else {
      this.content = tab.content
    }

    // 切换后立即恢复新标签的状态
    await this.restoreEditorState(tab.crepe.cursor, tab.crepe.scrollTop)

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
    this.stateManager.detach()

    eventBus.emit(AppEvents.EDITOR_DESTROYED, { tabId: this.currentTabId })
  }

  isReady(): boolean {
    return this.isInitialized && this.crepe !== null
  }

  focus(): void {
    if (!this.isInitialized) {
      return
    }
    this.stateManager.focus()
  }

  async restoreEditorState(cursor: { from: number; to: number }, scrollTop: number): Promise<void> {
    if (!this.isInitialized) return

    await new Promise(resolve => setTimeout(resolve, 50))
    this.stateManager.restoreState(cursor, scrollTop)
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

  getCurrentEditorState(): { cursor?: { from: number; to: number }, scrollTop?: number } {
    if (!this.isInitialized) {
      return {}
    }
    return this.stateManager.getCurrentState()
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

    // 将 yaml 代码块转回 frontmatter 格式
    const frontmatterContent = convertCodeBlockToFrontmatter(markdown)

    if (this.content === frontmatterContent) {
      return
    }

    if (this.activeEditor === 'codemirror') {
      return
    }

    this.content = frontmatterContent

    if (this.currentTabId) {
      const tabsStore = useTabsStore()
      tabsStore.updateTab(this.currentTabId, {
        content: frontmatterContent,
        isDirty: true,
        lastModified: Date.now(),
      })

      this.contentCache.set(this.currentTabId, frontmatterContent)
    }

    eventBus.emit(AppEvents.CONTENT_CHANGED, {
      content: frontmatterContent,
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
    if (!this.crepe || !this.isInitialized) {
      return
    }

    const preferences = usePreferencesStore()
    const effectiveTheme = preferences.theme === 'system'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')
      : preferences.theme

    console.log(`[CrepeEditorManager] 切换主题为：${effectiveTheme}`)

    // 发送主题变化事件，自定义 CodeMirror 插件会监听此事件并更新主题
    eventBus.emit(AppEvents.THEME_CHANGED, effectiveTheme as 'light' | 'dark' | 'system')
    
    console.log('[CrepeEditorManager] 主题切换事件已发送，CodeMirror 代码块将自动更新主题')
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
    this.commands.insertImage(imageUrl, altText)
  }

  undo(): void {
    this.commands.undo()
  }

  redo(): void {
    this.commands.redo()
  }

  toggleBold(): void {
    this.commands.toggleBold()
  }

  toggleItalic(): void {
    this.commands.toggleItalic()
  }

  toggleStrikethrough(): void {
    this.commands.toggleStrikethrough()
  }

  toggleInlineCode(): void {
    this.commands.toggleInlineCode()
  }

  toggleLink(): void {
    this.commands.toggleLink()
  }

  toggleHeading(level: number): void {
    this.commands.toggleHeading(level)
  }

  toggleParagraph(): void {
    this.commands.toggleParagraph()
  }

  toggleHighlight(): void {
    this.commands.toggleHighlight()
  }

  toggleBulletList(): void {
    this.commands.toggleBulletList()
  }

  toggleOrderedList(): void {
    this.commands.toggleOrderedList()
  }

  toggleTaskList(): void {
    this.commands.toggleTaskList()
  }

  toggleBlockQuote(): void {
    this.commands.toggleBlockQuote()
  }

  toggleCodeBlock(): void {
    this.commands.toggleCodeBlock()
  }

  toggleCodeFence(): void {
    this.commands.toggleCodeFence()
  }

  insertCodeBlock(): void {
    this.commands.insertCodeBlock()
  }

  insertMathBlock(): void {
    this.commands.insertMathBlock()
  }

  insertHorizontalRule(): void {
    this.commands.insertHorizontalRule()
  }

  insertTable(): void {
    this.commands.insertTable()
  }

  insertTableRowAbove(): void {
    this.commands.insertTableRowAbove()
  }

  insertTableRowBelow(): void {
    this.commands.insertTableRowBelow()
  }

  deleteTableRow(): void {
    this.commands.deleteTableRow()
  }

  insertTableColumnLeft(): void {
    this.commands.insertTableColumnLeft()
  }

  insertTableColumnRight(): void {
    this.commands.insertTableColumnRight()
  }

  deleteTableColumn(): void {
    this.commands.deleteTableColumn()
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
