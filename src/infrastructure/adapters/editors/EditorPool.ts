// ============================================================
// EditorPool — 多实例编辑器池
// ============================================================
//
// 管理每个 Tab 独立的 Crepe + CodeMirror 实例。
// 切换 Tab 时仅显示/隐藏容器，不销毁重建，保留 undo/redo 历史。

import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import type { ViewMode } from '@shared/types'
import { codeBlockSearchHighlight } from '@/services/search/codeBlockSearchHighlight'
import { createImagePastePlugin } from '@/plugins/imagePastePlugin'
import { focusModePlugin } from '@/plugins/focusModePlugin'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import { ImageStorageGateway } from '@adapters/gateways/image/ImageStorageGateway'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'
import { useFileSystemGateway } from '@adapters/gateways/FileSystemGateway'
import { join, isAbsolute, normalizePath } from '@/services/image/strategies/pathUtils'
import { debounce } from '@/utils/helpers'
import { createCodeMirrorView, updateEditorTheme, type EditorView, type ThemeType } from '@/components/Editor/codemirror/setup'
import { CodeMirrorSearchService } from '@/services/search'
import type { SearchService } from '@/services/search/types'

/** Markdown 更新防抖延迟 */
const MARKDOWN_UPDATE_DEBOUNCE_MS = 200

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

  constructor(
    getCurrentFilePath: () => string | undefined,
    getCurrentFileDir: () => string | undefined,
    imageInsertService: ImageInsertService,
    getImageOptions: () => ImageInsertOptions,
    getImageContext: () => ImageInsertContext,
    isDarkMode: () => boolean
  ) {
    this.getCurrentFilePathFn = getCurrentFilePath
    this.getCurrentFileDirFn = getCurrentFileDir
    this.imageInsertService = imageInsertService
    this.getImageOptions = getImageOptions
    this.getImageContext = getImageContext
    this.isDarkModeFn = isDarkMode
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
      console.log('[EditorPool] Wrapper not ready, queued tab:', tabId)
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
        ctx.get(listenerCtx).markdownUpdated(
          debounce((...args: unknown[]) => {
            const markdown = args[1] as string
            this.handleMarkdownUpdate(tabId, markdown)
          }, MARKDOWN_UPDATE_DEBOUNCE_MS)
        )

        ctx.get(listenerCtx).updated((ctx) => {
          try {
            const view = ctx.get(editorViewCtx)
            const { from, to } = view.state.selection
            this.emitCursorChange(from, to)
          } catch {
            // ignore
          }
        })

        ctx.get(listenerCtx).selectionUpdated((_ctx, selection) => {
          try {
            const { from, to } = selection
            this.emitCursorChange(from, to)
          } catch {
            // ignore
          }
        })
      })
      .use(listener)
      .use(createImagePastePlugin(this.imageInsertService, this.getImageOptions, this.getImageContext))
      .use(focusModePlugin)

    // 创建 Crepe 编辑器
    await crepe.create()

    // 创建 CodeMirror 实例（初始隐藏）
    const cmView = createCodeMirrorView({
      root: cmContainer,
      content,
      onChange: (getString: () => string) => {
        const markdown = getString()
        this.handleCMUpdate(tabId, markdown)
      },
      onFocus: () => {},
      onBlur: () => {},
      theme: isDark ? 'dark' : 'light',
    })

    const instance: TabEditorInstance = {
      tabId,
      crepe,
      cmView,
      container,
      crepeContainer,
      cmContainer,
      splitterEl,
      viewMode,
      content,
      isReady: true,
    }

    this.instances.set(tabId, instance)
    this.applyViewMode(instance)

    // 如果这是活动 tab，自动显示
    if (this.activeTabId === tabId) {
      this.showTab(tabId)
    }

    const createTime = performance.now() - startTime
    console.log('[EditorPool] createTab done', { tabId, createTime: createTime.toFixed(2) })
  }

  async destroyTab(tabId: string): Promise<void> {
    const instance = this.instances.get(tabId)
    if (!instance) return

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
    } else if (instance.cmView && instance.viewMode === 'source') {
      instance.cmView.focus()
    }
  }

  hideTab(tabId: string): void {
    const instance = this.instances.get(tabId)
    if (!instance) return
    instance.container.style.display = 'none'
  }

  // ============================================================
  // 视图模式
  // ============================================================

  setViewMode(tabId: string, mode: ViewMode): void {
    const instance = this.instances.get(tabId)
    if (!instance) return

    instance.viewMode = mode
    this.applyViewMode(instance)
  }

  private applyViewMode(instance: TabEditorInstance): void {
    const { viewMode, container, crepeContainer, cmContainer, splitterEl } = instance

    // 同步 container 的 mode class，让 CSS 布局选择器生效
    // CSS 中 .tab-editor-container.mode-split { flex-direction: row } 等规则依赖此 class
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

  // ============================================================
  // 内容操作
  // ============================================================

  getMarkdown(tabId?: string): string {
    const id = tabId || this.activeTabId
    if (!id) return ''

    const instance = this.instances.get(id)
    if (!instance?.crepe) return instance?.content || ''

    try {
      const markdown = instance.crepe.getMarkdown()
      return markdown || instance.content
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
      const { getHTML } = require('@milkdown/kit/utils')
      return instance.crepe.editor.action(getHTML())
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

  getInstance(tabId: string): TabEditorInstance | undefined {
    return this.instances.get(tabId)
  }

  isReady(tabId?: string): boolean {
    const id = tabId || this.activeTabId
    if (!id) return false
    const instance = this.instances.get(id)
    return instance?.isReady ?? false
  }

  getView(tabId?: string): any | null {
    const id = tabId || this.activeTabId
    if (!id) return null

    const instance = this.instances.get(id)
    if (!instance?.crepe) return null

    let view: any = null
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

  getHeadings(tabId?: string): Array<{ text: string; level: number; line: number; pos: number }> {
    const id = tabId || this.activeTabId
    if (!id) return []

    const instance = this.instances.get(id)
    if (!instance?.crepe) return []

    const headings: Array<{ text: string; level: number; line: number; pos: number }> = []
    instance.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const doc = view.state.doc

        doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            const text = node.textContent.trim()
            const level = node.attrs.level || 1
            const textBefore = doc.textBetween(0, pos)
            const line = textBefore.split('\n').length
            headings.push({ text, level, line, pos })
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
          .setSelection(require('@milkdown/kit/prose/state').Selection.near(resolvedPos, 1))
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

    const { insert } = require('@milkdown/kit/utils')
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
        const currentContent = instance.crepe.getMarkdown() || instance.content
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
            ctx.get(listenerCtx).markdownUpdated(
              debounce((...args: unknown[]) => {
                const markdown = args[1] as string
                this.handleMarkdownUpdate(tabId, markdown)
              }, MARKDOWN_UPDATE_DEBOUNCE_MS)
            )
          })
          .use(listener)

        await crepe.create()
        instance.crepe = crepe
        instance.content = currentContent
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

  private emitCursorChange(from: number, to: number): void {
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

  private handleMarkdownUpdate(tabId: string, markdown: string): void {
    const instance = this.instances.get(tabId)
    if (!instance) return

    if (instance.content === markdown) return

    instance.content = markdown

    // 仅活动 tab 触发回调
    if (tabId === this.activeTabId) {
      this.emitContentChange(markdown)
    }
  }

  private handleCMUpdate(tabId: string, content: string): void {
    const instance = this.instances.get(tabId)
    if (!instance) return

    instance.content = content

    // 同步到 Crepe
    if (instance.crepe && instance.viewMode !== 'source') {
      try {
        const { replaceAll } = require('@milkdown/kit/utils')
        instance.crepe.editor.action(replaceAll(content))
      } catch {
        // ignore
      }
    }

    // 仅活动 tab 触发回调
    if (tabId === this.activeTabId) {
      this.emitContentChange(content)
    }
  }

  // ============================================================
  // 搜索服务
  // ============================================================

  getCMSearchService(tabId?: string): SearchService | null {
    const id = tabId || this.activeTabId
    if (!id) return null

    const instance = this.instances.get(id)
    if (!instance?.cmView) return null

    return new CodeMirrorSearchService(() => instance.cmView)
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
