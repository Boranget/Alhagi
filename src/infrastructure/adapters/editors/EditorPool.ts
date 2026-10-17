// ============================================================
// EditorPool — 多实例编辑器池
// ============================================================
//
// 管理每个 Tab 独立的 Crepe + CodeMirror 实例。
// 切换 Tab 时仅显示/隐藏容器，不销毁重建，保留 undo/redo 历史。

import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { replaceAll, insert, getHTML as getHTMLUtil, callCommand } from '@milkdown/kit/utils'
import { undoCommand, redoCommand } from '@milkdown/plugin-history'
import { undo as cmUndo, redo as cmRedo } from '@codemirror/commands'
import { Selection, TextSelection } from '@milkdown/kit/prose/state'
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import type { ViewMode } from '@shared/types'
import { codeBlockSearchHighlight } from '@/services/search/codeBlockSearchHighlight'
import { createImagePastePlugin } from '@/plugins/imagePastePlugin'
import { focusModePlugin, focusModePluginKey } from '@/plugins/focusModePlugin'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import { ImageStorageGateway } from '@adapters/gateways/image/ImageStorageGateway'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'
import { useFileSystemGateway } from '@adapters/gateways/FileSystemGateway'
import { join, isAbsolute, normalizePath } from '@/services/image/strategies/pathUtils'

import { createCodeMirrorView, updateEditorTheme, ExternalChange, type EditorView, type ThemeType } from '@/components/Editor/codemirror/setup'
import type { EditorView as ProseMirrorEditorView } from '@milkdown/kit/prose/view'
import { startDocumentSync, type DocumentSync } from './documentSync'
import { resolveHistorySide, type HistorySide } from './historySide'
import { CodeMirrorSearchService, searchPlugin } from '@/services/search'
import type { SearchService } from '@/services/search/types'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'

// ============================================================
// TabEditorInstance — 单个 Tab 的编辑器单元
// ============================================================

interface TabEditorInstance {
  tabId: string
  crepe: Crepe | null
  cmView: EditorView | null
  container: HTMLDivElement        // 外层容器，包含 crepe 和 cm
  crepeContainer: HTMLDivElement   // Crepe 的 root
  cmContainer: HTMLDivElement      // CodeMirror 的 root
  splitterEl: HTMLDivElement       // 分割线
  viewMode: ViewMode
  content: string
  isReady: boolean
  /** 权威（tabsStore）与两侧编辑器的同步器 */
  docSync: DocumentSync | null
  /** applyContentToCrepe 灌入后的 PM doc 引用；listener echo 按引用比对抑制回写 */
  lastAppliedCrepeDoc: unknown | null
  /** PM 侧 contenteditable DOM（focusin 监听与焦点判定用） */
  crepeDom: HTMLElement | null
  /** 本 tab 内最后一次获得焦点的一侧；菜单夺焦后 undo 分派的依据 */
  lastFocusedEditor: HistorySide | null
  /** IME 组合期被挂起的权威回写待办；compositionend 后重读权威应用 */
  compositionApplyPending: boolean
}

// ============================================================
// EditorPool — 实例池
// ============================================================

export class EditorPool {
  private instances = new Map<string, TabEditorInstance>()
  private wrapper: HTMLElement | null = null
  private activeTabId: string | null = null

  // 待处理队列：wrapper 未就绪时暂存的 createTab 调用
  private pendingQueue: Array<{ tabId: string; content: string; viewMode: ViewMode }> = []

  // 回调
  private contentChangeCallbacks: ((markdown: string) => void)[] = []
  private cursorChangeCallbacks: ((from: number, to: number) => void)[] = []

  // 配置
  private getCurrentFilePathFn: () => string | undefined
  private getCurrentFileDirFn: () => string | undefined
  private imageInsertService: ImageInsertService
  private getImageOptions: () => ImageInsertOptions
  private getImageContext: () => ImageInsertContext
  private isDarkModeFn: () => boolean
  private isFocusModeFn: () => boolean
  private tabRepository: ITabRepository

  constructor(
    getCurrentFilePath: () => string | undefined,
    getCurrentFileDir: () => string | undefined,
    imageInsertService: ImageInsertService,
    getImageOptions: () => ImageInsertOptions,
    getImageContext: () => ImageInsertContext,
    isDarkMode: () => boolean,
    isFocusMode: () => boolean,
    tabRepository: ITabRepository
  ) {
    this.getCurrentFilePathFn = getCurrentFilePath
    this.getCurrentFileDirFn = getCurrentFileDir
    this.imageInsertService = imageInsertService
    this.getImageOptions = getImageOptions
    this.getImageContext = getImageContext
    this.isDarkModeFn = isDarkMode
    this.isFocusModeFn = isFocusMode
    this.tabRepository = tabRepository
  }

  // ============================================================
  // 初始化
  // ============================================================

  initWrapper(wrapper: HTMLElement): void {
    this.wrapper = wrapper

    // 处理待处理队列
    if (this.pendingQueue.length > 0) {
      const queue = [...this.pendingQueue]
      this.pendingQueue = []
      for (const item of queue) {
        this.createTab(item.tabId, item.content, item.viewMode)
      }
    }
  }

  /**
   * 解绑 wrapper 容器，销毁所有编辑器实例并清理状态。
   *
   * 与 initWrapper 形成对称的生命周期对：
   *   initWrapper（绑定） ↔ detach（解绑）
   *
   * 在 EditorContainer 卸载时调用，确保 EditorPool 不会持有
   * 已脱离 DOM 树的失效 wrapper 引用。
   */
  async detach(): Promise<void> {
    // 销毁所有 tab 实例（Crepe + CM + DOM 节点）
    for (const [tabId] of this.instances) {
      await this.destroyTab(tabId)
    }

    // 清除状态，使下次 createTab 进入 pendingQueue
    this.wrapper = null
    this.activeTabId = null
    this.pendingQueue = []
  }

  // ============================================================
  // Tab 生命周期
  // ============================================================

  async createTab(tabId: string, content: string, viewMode: ViewMode = 'wysiwyg'): Promise<void> {
    if (!this.wrapper) {
      // wrapper 未就绪，加入待处理队列
      this.pendingQueue.push({ tabId, content, viewMode })
      return
    }

    if (this.instances.has(tabId)) {
      console.warn('[EditorPool] Tab already exists:', tabId)
      return
    }

    const startTime = performance.now()

    // 创建 DOM 容器树
    const container = document.createElement('div')
    container.className = 'tab-editor-container'
    container.dataset.tabId = tabId
    // 不设置 display:none，让 Crepe 在可见容器中创建以确保正确渲染
    // showTab 会在之后处理隐藏非活动 tab

    const crepeContainer = document.createElement('div')
    crepeContainer.className = 'crepe tab-editor-crepe'

    const cmContainer = document.createElement('div')
    cmContainer.className = 'tab-editor-cm'

    const splitterEl = document.createElement('div')
    splitterEl.className = 'tab-editor-splitter'
    splitterEl.innerHTML = '<div class="tab-editor-splitter-handle" />'

    container.appendChild(crepeContainer)
    container.appendChild(splitterEl)
    container.appendChild(cmContainer)
    this.wrapper.appendChild(container)

    // 创建 Crepe 实例
    const isDark = this.isDarkModeFn()
    const crepe = new Crepe({
      root: crepeContainer,
      defaultValue: content,
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: true,
        [CrepeFeature.LinkTooltip]: true,
        [CrepeFeature.Table]: true,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.Placeholder]: true,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: true,
      },
      featureConfigs: {
        [CrepeFeature.CodeMirror]: {
          theme: isDark ? undefined : eclipse,
          extensions: [codeBlockSearchHighlight()],
        },
        [CrepeFeature.ImageBlock]: {
          proxyDomURL: (url: string) => {
            if (/^(https?|data|file):/.test(url)) return url
            const dir = this.getCurrentFileDirFn()
            if (dir && !isAbsolute(url)) {
              const absolute = normalizePath(join(dir, url))
              return 'file:///' + absolute.replace(/\\/g, '/')
            }
            return url
          },
        },
      },
    })

    // 配置 Crepe 监听器
    crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(this.createMarkdownUpdatedHandler(tabId))

        ctx.get(listenerCtx).updated((ctx) => {
          try {
            const view = ctx.get(editorViewCtx)
            const { from, to } = view.state.selection
            this.emitCursorChange(from, to, tabId)
          } catch {
            // ignore
          }
        })

        ctx.get(listenerCtx).selectionUpdated((_ctx, selection) => {
          try {
            const { from, to } = selection
            this.emitCursorChange(from, to, tabId)
          } catch {
            // ignore
          }
        })
      })
      .use(listener)
      .use(createImagePastePlugin(this.imageInsertService, this.getImageOptions, this.getImageContext))
      .use(focusModePlugin)
      .use(searchPlugin)

    // 创建 Crepe 编辑器
    await crepe.create()

    // 懒建：CodeMirror 不在此创建，applyViewMode 在进入 source/split 时
    // 通过 ensureCodeMirror 按需建立，回到纯 wysiwyg 即销毁。
    const instance: TabEditorInstance = {
      tabId,
      crepe,
      cmView: null,
      container,
      crepeContainer,
      cmContainer,
      splitterEl,
      viewMode,
      content,
      isReady: true,
      docSync: null,
      lastAppliedCrepeDoc: null,
      crepeDom: null,
      lastFocusedEditor: null,
      compositionApplyPending: false,
    }

    // 焦点归属追踪：undo/redo 命令（菜单/命令面板）点击后 activeElement
    // 已离开编辑器，需记住最后聚焦的一侧才能与键盘 Ctrl+Z 行为一致。
    try {
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        if (!view) return
        instance.crepeDom = view.dom
        view.dom.addEventListener('focusin', () => {
          instance.lastFocusedEditor = 'crepe'
        })
      })
    } catch {
      // ignore
    }

    // 文档同步：tabsStore.content 为唯一权威，两侧编辑器订阅刷新。
    // split 实时同步、切模式交接、外部直写 store 的接入都由它统一承担。
    instance.docSync = startDocumentSync(tabId, this.tabRepository, {
      readVisible: () => this.readVisibleContent(instance),
      applyToWysiwyg: (doc) => this.applyContentToCrepe(instance, doc),
      applyToSource: (doc) => this.applyContentToCM(instance, doc),
      onAuthoritativeChange: (doc) => {
        if (tabId === this.activeTabId) this.emitContentChange(doc)
      },
    })

    this.instances.set(tabId, instance)
    this.applyViewMode(instance)

    // 如果这是活动 tab，自动显示
    if (this.activeTabId === tabId) {
      this.showTab(tabId)
    }

    const createTime = performance.now() - startTime
  }

  async destroyTab(tabId: string): Promise<void> {
    // 从创建队列中移除（wrapper 未就绪时关闭的 tab 不应再被创建）
    this.pendingQueue = this.pendingQueue.filter(item => item.tabId !== tabId)

    const instance = this.instances.get(tabId)
    if (!instance) return

    // 停止文档同步（watch + commit 通道）
    instance.docSync?.stop()
    instance.docSync = null

    // 销毁 Crepe
    if (instance.crepe) {
      instance.crepe.destroy()
      instance.crepe = null
    }

    // 销毁 CodeMirror
    if (instance.cmView) {
      instance.cmView.destroy()
      instance.cmView = null
    }

    // 移除 DOM
    instance.container.remove()

    this.instances.delete(tabId)

    if (this.activeTabId === tabId) {
      this.activeTabId = null
    }
  }

  // ============================================================
  // 显示/隐藏
  // ============================================================

  showTab(tabId: string): void {
    const instance = this.instances.get(tabId)
    if (!instance) {
      // 实例不存在（可能还在队列中），记录目标 tab
      this.activeTabId = tabId
      return
    }

    // 隐藏所有
    for (const [id, inst] of this.instances) {
      if (id !== tabId) {
        inst.container.style.display = 'none'
      }
    }

    // 显示目标
    instance.container.style.display = 'flex'
    this.activeTabId = tabId

    // 聚焦 Crepe
    if (instance.crepe && instance.viewMode !== 'source') {
      try {
        instance.crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          if (view) view.focus()
        })
      } catch {
        // ignore
      }
      this.syncFocusModeToActiveEditor(instance)
    } else if (instance.cmView && instance.viewMode === 'source') {
      instance.cmView.focus()
    }
  }

  hideTab(tabId: string): void {
    const instance = this.instances.get(tabId)
    if (!instance) return
    instance.container.style.display = 'none'
  }

  private syncFocusModeToActiveEditor(instance: { crepe: Crepe | null }): void {
    this.dispatchFocusModeMeta(instance, this.isFocusModeFn())
  }

  private dispatchFocusModeMeta(instance: { crepe: Crepe | null }, enabled: boolean): void {
    if (!instance.crepe) return
    try {
      instance.crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        if (view) {
          view.dispatch(view.state.tr.setMeta(focusModePluginKey, { enabled }))
        }
      })
    } catch {
      // ignore
    }
  }

  // ============================================================
  // 视图模式
  // ============================================================

  setViewMode(tabId: string, mode: ViewMode): void {
    const instance = this.instances.get(tabId)
    if (!instance) return
    if (instance.viewMode === mode) return

    // 冲刷 Crepe 防抖窗口：可见编辑器里的未 commit 内容先进权威，
    // watch 会把两侧刷成最新（含即将显示的隐藏侧），无需手动交接。
    instance.docSync?.flush()

    instance.viewMode = mode
    this.applyViewMode(instance)
  }

  private applyViewMode(instance: TabEditorInstance): void {
    const { viewMode, container, crepeContainer, cmContainer, splitterEl } = instance

    // 懒建：CM 只在需要显示的一侧存在；纯 wysiwyg 下销毁以省资源。
    // 创建时直接读权威内容（CM 不存在期间 store 可能已被外部改写）。
    if (viewMode === 'wysiwyg') {
      this.destroyCodeMirror(instance)
    } else {
      this.ensureCodeMirror(instance)
    }

    // 同步 container 的 mode class，让 CSS 布局选择器生效
    container.classList.remove('mode-wysiwyg', 'mode-source', 'mode-split')
    container.classList.add(`mode-${viewMode}`)

    switch (viewMode) {
      case 'wysiwyg':
        crepeContainer.style.display = 'block'
        crepeContainer.style.width = '100%'
        crepeContainer.style.order = '0'
        cmContainer.style.display = 'none'
        splitterEl.style.display = 'none'
        break

      case 'source':
        crepeContainer.style.display = 'none'
        cmContainer.style.display = 'block'
        cmContainer.style.width = '100%'
        cmContainer.style.order = '0'
        splitterEl.style.display = 'none'
        break

      case 'split':
        crepeContainer.style.display = 'block'
        crepeContainer.style.width = '50%'
        crepeContainer.style.order = '3'
        cmContainer.style.display = 'block'
        cmContainer.style.width = '50%'
        cmContainer.style.order = '1'
        splitterEl.style.display = 'flex'
        splitterEl.style.order = '2'
        break
    }
  }

  /**
   * 按需创建 CodeMirror（懒建）。
   * 内容直接取权威（tabsStore），因为 CM 不存在期间外部直写 store
   * 不会有人接收 applyToSource——创建即对齐，无一致性缺口。
   */
  private ensureCodeMirror(instance: TabEditorInstance): void {
    if (instance.cmView) return

    try {
      const content = this.tabRepository.getById(instance.tabId)?.content ?? instance.content
      let cmView: EditorView | null = null
      cmView = createCodeMirrorView({
        root: instance.cmContainer,
        content,
        onChange: (getString: () => string) => {
          this.handleCMUpdate(instance.tabId, getString())
        },
        onFocus: () => {},
        onBlur: () => {},
        // 源码模式光标移动也要驱动 CURSOR_CHANGED（打字机对齐 + cursor 持久化），
        // 否则 source 视图下打字机不生效。
        onSelectionChange: () => {
          if (!cmView) return
          const { from, to } = cmView.state.selection.main
          this.emitCursorChange(from, to, instance.tabId)
        },
        theme: this.isDarkModeFn() ? 'dark' : 'light',
      })
      cmView.dom.addEventListener('focusin', () => {
        instance.lastFocusedEditor = 'cm'
      })
      instance.cmView = cmView
    } catch (e) {
      console.error('[EditorPool] ensureCodeMirror failed', e)
    }
  }

  /** 销毁 CodeMirror（回纯 wysiwyg 时调用）。历史随之丢弃，与页面语义一致。 */
  private destroyCodeMirror(instance: TabEditorInstance): void {
    if (!instance.cmView) return
    instance.cmView.destroy()
    instance.cmView = null
  }

  // ============================================================
  // 内容操作
  // ============================================================

  /**
   * commit 边界上的唯一活读（flush → readVisible 专用）。
   * 组合期返回 null：此刻序列化出来的是暂态（PM 可能把裸拼音吞进 doc），
   * flush 随之空转，保存/导出/复制拿到的是已落定的权威内容——自动保存
   * debounce 落在组合窗口内时，否则会把裸拼音写进磁盘文件。
   * 与 listener 侧「组合期跳过提交」构成同一不变量的全部覆盖。
   */
  private readVisibleContent(instance: TabEditorInstance): string | null {
    try {
      if (instance.viewMode === 'source') {
        if (instance.cmView?.composing) return null
        return instance.cmView ? instance.cmView.state.doc.toString() : null
      }
      if (!instance.crepe) return null

      let composing = false
      instance.crepe.editor.action((ctx) => {
        composing = ctx.get(editorViewCtx)?.composing === true
      })
      if (composing) return null

      return instance.crepe.getMarkdown()
    } catch {
      return null
    }
  }

  getMarkdown(tabId?: string): string {
    const id = tabId || this.activeTabId
    if (!id) return ''

    // 冲刷 Crepe 防抖后从权威读取（保存/导出语义：拿到已落定的最新内容）
    const instance = this.instances.get(id)
    instance?.docSync?.flush()

    const authoritative = this.tabRepository.getById(id)?.content
    if (authoritative != null) return authoritative

    // 实例尚未建立时退回本地缓存
    if (!instance) return ''
    try {
      return instance.crepe?.getMarkdown() || instance.content
    } catch {
      return instance.content
    }
  }

  getHTML(tabId?: string): string {
    const id = tabId || this.activeTabId
    if (!id) return ''

    const instance = this.instances.get(id)
    if (!instance?.crepe) return ''

    try {
      return instance.crepe.editor.action(getHTMLUtil())
    } catch {
      return ''
    }
  }

  // ============================================================
  // 状态查询
  // ============================================================

  hasTab(tabId: string): boolean {
    return this.instances.has(tabId)
  }

  getActiveTabId(): string | null {
    return this.activeTabId
  }

  /**
   * 活动 tab 当前视图模式对应的滚动容器。
   * DOM 结构与视图模式的映射（wysiwyg/split → Crepe 容器，source → CM scroller）
   * 只由池持有；调用方不得再自行查询选择器。
   */
  getScrollContainer(): HTMLElement | null {
    const instance = this.activeTabId ? this.instances.get(this.activeTabId) : undefined
    if (!instance) return null
    if (instance.viewMode === 'source') {
      return instance.cmView?.scrollDOM ?? null
    }
    return instance.crepeContainer
  }

  /** 当前光标在视口坐标系中的 Y（px）；无实例/光标时 null。测量细节归池 */
  getCursorViewportY(): number | null {
    const instance = this.activeTabId ? this.instances.get(this.activeTabId) : undefined
    if (!instance) return null

    if (instance.viewMode === 'source') {
      const cmView = instance.cmView
      if (!cmView) return null
      try {
        const coords = cmView.coordsAtPos(cmView.state.selection.main.head)
        return coords?.top ?? null
      } catch {
        return null
      }
    }

    if (!instance.crepe) return null
    let result: number | null = null
    try {
      instance.crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        if (view) {
          const coords = view.coordsAtPos(view.state.selection.from)
          result = coords?.top ?? null
        }
      })
    } catch {
      return null
    }
    return result
  }

  /** 焦点模式 meta 派发（PM 插件 Decoration 开关），作用于活动 tab */
  setEditorFocusMode(enabled: boolean): void {
    const instance = this.activeTabId ? this.instances.get(this.activeTabId) : undefined
    if (!instance) return
    this.dispatchFocusModeMeta(instance, enabled)
  }

  getActiveCrepe(tabId?: string): Crepe | null {
    const id = tabId || this.activeTabId
    if (!id) return null
    const instance = this.instances.get(id)
    return instance?.crepe ?? null
  }

  getInstance(tabId: string): TabEditorInstance | undefined {
    return this.instances.get(tabId)
  }

  isReady(tabId?: string): boolean {
    const id = tabId || this.activeTabId
    if (!id) return false
    const instance = this.instances.get(id)
    return instance?.isReady ?? false
  }

  getView(tabId?: string): ProseMirrorEditorView | null {
    const id = tabId || this.activeTabId
    if (!id) return null

    const instance = this.instances.get(id)
    if (!instance?.crepe) return null

    let view: ProseMirrorEditorView | null = null
    instance.crepe.editor.action((ctx) => {
      const proseView = ctx.get(editorViewCtx)
      if (proseView) view = proseView
    })
    return view
  }

  getCMView(tabId?: string): EditorView | null {
    const id = tabId || this.activeTabId
    if (!id) return null
    const instance = this.instances.get(id)
    return instance?.cmView ?? null
  }

  getSelection(tabId?: string): { from: number; to: number } | null {
    const id = tabId || this.activeTabId
    if (!id) return null

    const instance = this.instances.get(id)
    if (!instance?.crepe) return null

    let selection: { from: number; to: number } | null = null
    instance.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const { from, to } = view.state.selection
        selection = { from, to }
      } catch {
        selection = null
      }
    })
    return selection
  }

  getHeadings(tabId?: string): Array<{ text: string; level: number; slug: string; line: number; pos: number }> {
    const id = tabId || this.activeTabId
    if (!id) return []

    const instance = this.instances.get(id)
    if (!instance?.crepe) return []

    const headings: Array<{ text: string; level: number; slug: string; line: number; pos: number }> = []
    instance.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const doc = view.state.doc

        doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            const text = node.textContent.trim()
            const level = node.attrs.level || 1
            const slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
            const textBefore = doc.textBetween(0, pos)
            const line = textBefore.split('\n').length
            headings.push({ text, level, slug, line, pos })
          }
        })
      } catch {
        // ignore
      }
    })
    return headings
  }

  scrollToHeading(pos: number, tabId?: string): void {
    const id = tabId || this.activeTabId
    if (!id || pos === undefined || pos < 0) return

    const instance = this.instances.get(id)
    if (!instance?.crepe) return

    instance.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const resolvedPos = view.state.doc.resolve(pos)
        const tr = view.state.tr
          .setSelection(Selection.near(resolvedPos, 1))
          .scrollIntoView()

        view.dispatch(tr)
        view.focus()
      } catch (error) {
        console.error('[EditorPool] scrollToHeading error:', error)
      }
    })
  }

  // ============================================================
  // 图片操作
  // ============================================================

  insertImage(imageUrl: string, altText: string, tabId?: string): void {
    const id = tabId || this.activeTabId
    if (!id) return

    const instance = this.instances.get(id)
    if (!instance?.crepe) return

    const imageMarkdown = `![${altText || 'image'}](${imageUrl})`
    instance.crepe.editor.action(insert(imageMarkdown, true))
  }

  // ============================================================
  // 主题
  // ============================================================

  async updateTheme(isDark: boolean): Promise<void> {
    for (const [tabId, instance] of this.instances) {
      // 更新 CodeMirror 主题
      if (instance.cmView) {
        updateEditorTheme(instance.cmView, isDark ? 'dark' : 'light')
      }

      // Crepe 主题更新需要销毁重建
      if (instance.crepe && instance.container) {
        // '' 是有效内容（用户清空文档），不能用 || 回退到旧缓存
        let currentContent = instance.content
        try {
          currentContent = instance.crepe.getMarkdown()
        } catch {
          // 读取失败退回 instance.content
        }
        const container = instance.crepeContainer

        // 销毁旧 Crepe
        instance.crepe.destroy()
        container.innerHTML = ''

        // 创建新 Crepe
        const crepe = new Crepe({
          root: container,
          defaultValue: currentContent,
          features: {
            [CrepeFeature.BlockEdit]: false,
            [CrepeFeature.CodeMirror]: true,
            [CrepeFeature.LinkTooltip]: true,
            [CrepeFeature.Table]: true,
            [CrepeFeature.Toolbar]: false,
            [CrepeFeature.Placeholder]: true,
            [CrepeFeature.Cursor]: false,
            [CrepeFeature.ImageBlock]: true,
          },
          featureConfigs: {
            [CrepeFeature.CodeMirror]: {
              theme: isDark ? undefined : eclipse,
              extensions: [codeBlockSearchHighlight()],
            },
            [CrepeFeature.ImageBlock]: {
              proxyDomURL: (url: string) => {
                if (/^(https?|data|file):/.test(url)) return url
                const dir = this.getCurrentFileDirFn()
                if (dir && !isAbsolute(url)) {
                  const absolute = normalizePath(join(dir, url))
                  return 'file:///' + absolute.replace(/\\/g, '/')
                }
                return url
              },
            },
          },
        })

        crepe.editor
          .config((ctx) => {
            ctx.get(listenerCtx).markdownUpdated(this.createMarkdownUpdatedHandler(tabId))
          })
          .use(listener)

        await crepe.create()
        instance.crepe = crepe
        instance.content = currentContent
        instance.lastAppliedCrepeDoc = null
        instance.compositionApplyPending = false

        // 防抖窗口内未落定的编辑可能只存在于旧 Crepe 里；重建后统一进权威，
        // watch 会把 CM 一并刷齐。内容相同则幂等跳过。
        instance.docSync?.commit(currentContent)
      }
    }
  }

  // ============================================================
  // 事件
  // ============================================================

  onContentChange(callback: (markdown: string) => void): () => void {
    this.contentChangeCallbacks.push(callback)
    return () => {
      const index = this.contentChangeCallbacks.indexOf(callback)
      if (index > -1) this.contentChangeCallbacks.splice(index, 1)
    }
  }

  onCursorChange(callback: (from: number, to: number) => void): () => void {
    this.cursorChangeCallbacks.push(callback)
    return () => {
      const index = this.cursorChangeCallbacks.indexOf(callback)
      if (index > -1) this.cursorChangeCallbacks.splice(index, 1)
    }
  }

  private emitContentChange(markdown: string): void {
    for (const cb of this.contentChangeCallbacks) {
      try {
        cb(markdown)
      } catch (e) {
        console.error('[EditorPool] contentChange callback error:', e)
      }
    }
  }

  private emitCursorChange(from: number, to: number, tabId?: string): void {
    // 只上报活动 tab：隐藏实例的内容同步/焦点恢复会触发 selection 回调，
    // 若不过滤，会把后台 tab 的选区写进活动 tab 的 cursor 持久化，并误触打字机对齐。
    if (tabId !== undefined && tabId !== this.activeTabId) return
    for (const cb of this.cursorChangeCallbacks) {
      try {
        cb(from, to)
      } catch (e) {
        console.error('[EditorPool] cursorChange callback error:', e)
      }
    }
  }

  // ============================================================
  // 内部更新处理
  // ============================================================

  /**
   * markdownUpdated 处理器（同步；事件侧 @milkdown/plugin-listener 已自带 200ms 合并，
   * 不再叠加第二层 debounce——叠加会在「快照捕获 → 延迟提交」之间打开陈旧窗口）。
   * args 约定：[ctx, markdown, prevMarkdown]（@milkdown/plugin-listener 签名）。
   * 回调时刻从 ctx 读取当前 doc，供 echo 抑制按引用比对。
   */
  private createMarkdownUpdatedHandler(tabId: string) {
    return (...args: unknown[]) => {
      let currentDoc: unknown = null
      let composing = false
      try {
        const ctx = args[0] as {
          get: (slice: typeof editorViewCtx) => { state: { doc: unknown }; composing: boolean } | null
        }
        const view = ctx.get(editorViewCtx)
        currentDoc = view?.state?.doc ?? null
        composing = view?.composing === true
      } catch {
        // ignore
      }
      this.handleMarkdownUpdate(tabId, currentDoc, composing)
    }
  }

  private handleMarkdownUpdate(tabId: string, currentDoc: unknown, composing: boolean): void {
    const instance = this.instances.get(tabId)
    if (!instance) return

    // echo 抑制：本次事务是 applyContentToCrepe 从权威灌入的
    // （灌入后无任何用户新事务，doc 引用未变）。严格按引用比对，无时序窗。
    if (currentDoc != null && currentDoc === instance.lastAppliedCrepeDoc) {
      return
    }

    // 组合期绝不写权威：PM 在组合中可能已把裸拼音字母吞进 doc（Windows
    // Chromium readDOMChange 行为），此刻序列化出来的是暂态垃圾——写进 store
    // 会被自动保存/回写管道消费。跳过后 compositionend 的落定事务会在
    // 200ms 内重新触发本处理器，提交的就是最终中文。
    if (composing) return

    // 现场序列化：commit 永远取编辑器此刻的内容，而非事件参数里的旧快照。
    // 若提交过期快照，apply 侧「现场序列化 vs 权威」比对必然不等 →
    // 误判外部变更 → replaceAll(旧内容) 回退刚敲的字，且组合期派发会
    // 打断 IME（拼音被冻结成普通文本，残留到中文前面）。
    let markdown: string | null = null
    try {
      markdown = instance.crepe ? instance.crepe.getMarkdown() : null
    } catch {
      return
    }
    if (markdown == null) return

    instance.docSync?.commit(markdown)
  }

  private handleCMUpdate(tabId: string, content: string): void {
    const instance = this.instances.get(tabId)
    if (!instance) return

    // 与 Crepe 侧同理：组合期 CM doc 里的裸拼音是暂态，不进权威
    if (instance.cmView?.composing) return

    instance.docSync?.commit(content)
  }

  /**
   * 权威 → Crepe。比对相同则不动编辑器（保护光标/undo）——注意相等检查
   * 必须在组合检查之前：组合期产生的 store 变更多为自身 echo，内容相等
   * 时直接返回，绝不挂起；否则 compositionend 的 finish 会拿暂态 store
   * 覆盖刚落定的中文（ni'h 回归）。仅真正不等的外部变更才挂起。
   * IME 组合期禁止派发：replaceAll 会强制打断输入法组合。
   */
  private applyContentToCrepe(instance: TabEditorInstance, content: string): void {
    instance.content = content
    if (!instance.crepe) return

    try {
      if ((instance.crepe.getMarkdown() || '') === content) return

      let composing = false
      instance.crepe.editor.action((ctx) => {
        composing = ctx.get(editorViewCtx)?.composing === true
      })
      if (composing) {
        this.scheduleApplyAfterComposition(instance, 'crepe')
        return
      }

      instance.crepe.editor.action((ctx) => {
        replaceAll(content)(ctx)
        instance.lastAppliedCrepeDoc = ctx.get(editorViewCtx).state.doc
      })
    } catch (e) {
      console.error('[EditorPool] applyContentToCrepe failed', e)
    }
  }

  /** 权威 → CodeMirror。ExternalChange 注解阻止回灌 handleCMUpdate。同样相等先于组合检查。 */
  private applyContentToCM(instance: TabEditorInstance, content: string): void {
    instance.content = content
    if (!instance.cmView) return

    try {
      const current = instance.cmView.state.doc.toString()
      if (current === content) return

      if (instance.cmView.composing) {
        this.scheduleApplyAfterComposition(instance, 'cm')
        return
      }

      instance.cmView.dispatch({
        changes: { from: 0, to: instance.cmView.state.doc.length, insert: content },
        annotations: ExternalChange.of(true),
      })
    } catch (e) {
      console.error('[EditorPool] applyContentToCM failed', e)
    }
  }

  /**
   * 组合期挂起的权威回写：compositionend 后重读权威最新值再应用两侧
   * （重入 apply 走正常比对，内容相同则各自幂等跳过）。
   * 仅在「内容确实不等 + 正在组合」时才会挂起——即真外部写入落进组合期；
   * 组合期的自身 echo 已被相等检查拦截，不会产生 finish 覆盖刚提交中文的竞态。
   * 单 pending 位即可：同一 tab 不可能同时在两个视图发起输入法组合；
   * 若挂起期间 DOM 被销毁、事件永不触发，flag 残留也只影响下一次挂起
   * （正常 apply 路径不看 flag，下次内容变更仍会应用，不产生发散）。
   */
  private scheduleApplyAfterComposition(instance: TabEditorInstance, side: 'crepe' | 'cm'): void {
    if (instance.compositionApplyPending) return

    let dom: HTMLElement | null = null
    if (side === 'crepe') {
      try {
        instance.crepe?.editor.action((ctx) => {
          dom = ctx.get(editorViewCtx)?.dom ?? null
        })
      } catch {
        // ignore
      }
    } else {
      dom = instance.cmView?.dom ?? null
    }
    if (!dom) return
    const target: HTMLElement = dom

    instance.compositionApplyPending = true
    const finish = () => {
      target.removeEventListener('compositionend', finish)
      instance.compositionApplyPending = false
      const latest = this.tabRepository.getById(instance.tabId)?.content
      if (latest != null) {
        this.applyContentToCrepe(instance, latest)
        this.applyContentToCM(instance, latest)
      }
    }
    target.addEventListener('compositionend', finish)
  }

  // ============================================================
  // 历史 / 焦点 / 选区
  // ============================================================

  /**
   * 命令驱动 undo/redo 的目标侧。与键盘路径（keybinding 放行给聚焦编辑器）
   * 使用同一判定：source/wysiwyg 按模式，split 按焦点/最后聚焦侧。
   */
  private historySide(instance: TabEditorInstance): HistorySide {
    const active = document.activeElement
    return resolveHistorySide({
      viewMode: instance.viewMode,
      activeInCM: !!active && !!instance.cmView && instance.cmView.dom.contains(active),
      activeInCrepe: !!active && !!instance.crepeDom && instance.crepeDom.contains(active),
      lastFocused: instance.lastFocusedEditor,
    })
  }

  undo(): void {
    const instance = this.activeTabId ? this.instances.get(this.activeTabId) : null
    if (!instance) return
    if (this.historySide(instance) === 'cm') {
      if (instance.cmView) cmUndo(instance.cmView)
      return
    }
    if (instance.crepe) {
      try {
        instance.crepe.editor.action(callCommand(undoCommand.key))
      } catch {
        // ignore
      }
    }
  }

  redo(): void {
    const instance = this.activeTabId ? this.instances.get(this.activeTabId) : null
    if (!instance) return
    if (this.historySide(instance) === 'cm') {
      if (instance.cmView) cmRedo(instance.cmView)
      return
    }
    if (instance.crepe) {
      try {
        instance.crepe.editor.action(callCommand(redoCommand.key))
      } catch {
        // ignore
      }
    }
  }

  focus(): void {
    const instance = this.activeTabId ? this.instances.get(this.activeTabId) : null
    if (!instance) return
    if (instance.viewMode === 'source') {
      instance.cmView?.focus()
      return
    }
    if (instance.crepe) {
      try {
        instance.crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          if (view) view.focus()
        })
      } catch {
        // ignore
      }
    }
  }

  selectAll(): void {
    const instance = this.activeTabId ? this.instances.get(this.activeTabId) : null
    if (!instance) return
    if (instance.viewMode === 'source') {
      const cmView = instance.cmView
      if (!cmView) return
      cmView.focus()
      cmView.dispatch({ selection: { anchor: 0, head: cmView.state.doc.length } })
      return
    }
    if (instance.crepe) {
      try {
        instance.crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          if (!view) return
          const { doc } = view.state
          view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, 0, doc.content.size)))
          view.focus()
        })
      } catch {
        // ignore
      }
    }
  }

  // 在光标/选区处插入纯文本（粘贴回退路径；不解析 markdown）
  insertText(text: string): void {
    const instance = this.activeTabId ? this.instances.get(this.activeTabId) : null
    if (!instance) return
    if (instance.viewMode === 'source') {
      const cmView = instance.cmView
      if (!cmView) return
      const range = cmView.state.selection.main
      cmView.dispatch({
        changes: { from: range.from, to: range.to, insert: text },
        selection: { anchor: range.from + text.length },
        scrollIntoView: true,
      })
      cmView.focus()
      return
    }
    if (instance.crepe) {
      try {
        instance.crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          if (!view) return
          view.dispatch(view.state.tr.insertText(text))
          view.focus()
        })
      } catch {
        // ignore
      }
    }
  }

  // ============================================================
  // 搜索服务
  // ============================================================

  getCMSearchService(tabId?: string): SearchService | null {
    // 视图按调用时刻解析：省略 tabId 时每次取视图都跟随当前活动 tab，显式
    // tabId 则锁定该 tab——构造闭包不再绑死实例。否则 source 模式 md→md 切
    // tab 后（EditorContainer 的 computed 因 descriptor 是 registry 单例而不
    // 重算），服务会一直指向旧 tab 的隐藏视图。
    const resolveView = (): EditorView | null => {
      const id = tabId || this.activeTabId
      if (!id) return null
      return this.instances.get(id)?.cmView ?? null
    }

    if (!resolveView()) return null
    return new CodeMirrorSearchService(resolveView)
  }

  // ============================================================
  // 清理
  // ============================================================

  async destroyAll(): Promise<void> {
    for (const [tabId] of this.instances) {
      await this.destroyTab(tabId)
    }
    this.wrapper = null
    this.activeTabId = null
    this.contentChangeCallbacks = []
    this.cursorChangeCallbacks = []
  }
}
