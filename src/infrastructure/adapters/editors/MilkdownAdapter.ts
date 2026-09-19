// ============================================================
// MilkdownAdapter — Milkdown/Crepe 编辑器适配器
// ============================================================
//
// 实现 IEditorProvider 接口，封装所有 Milkdown/Crepe 特定逻辑。
// 内联了原 CrepeEditorManager 的核心逻辑，移除了所有 Store 依赖。

import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Slice } from '@milkdown/kit/prose/model'
import { Selection as ProseSelection } from '@milkdown/kit/prose/state'
import { replaceAll, getMarkdown, getHTML, insert } from '@milkdown/kit/utils'
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import { nord } from '@uiw/codemirror-theme-nord'
import type { ViewMode } from '@shared/types'
import type { HeadingItem } from '@/utils/headings'
import { generateSlug } from '@/utils/headings'
import { codeBlockSearchHighlight } from '@/services/search/codeBlockSearchHighlight'
import { createImagePastePlugin } from '@/plugins/imagePastePlugin'
import { focusModePlugin } from '@/plugins/focusModePlugin'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import { ImageStorageGateway } from '@adapters/gateways/image/ImageStorageGateway'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'
import { useFileSystemGateway } from '@adapters/gateways/FileSystemGateway'
import { join, isAbsolute, normalizePath } from '@/services/image/strategies/pathUtils'
import type { IEditorProvider, Selection, Heading } from '@core/domain/ports/IEditorProvider'
import { debounce } from '@/utils/helpers'
import { LRUCache } from '@/utils/performance'

/** Markdown 更新防抖延迟 */
const MARKDOWN_UPDATE_DEBOUNCE_MS = 200
/** 等待 ProseMirror 更新 DOM 后执行滚动的延迟 */
const SCROLL_DOM_SYNC_DELAY_MS = 50

export class MilkdownAdapter implements IEditorProvider {
  private crepe: Crepe | null = null
  private content = ''
  private currentTabId: string | null = null
  private currentMode: ViewMode = 'wysiwyg'
  private contentCache = new LRUCache<string>(20)
  private isUpdatingContent = false
  private isInitialized = false
  private activeEditor: 'crepe' | 'codemirror' | null = null
  private container: HTMLElement | null = null
  private cursorChangeHandler: ((from: number, to: number) => void) | null = null
  private contentChangeCallbacks: ((markdown: string) => void)[] = []
  private cursorChangeCallbacks: ((from: number, to: number) => void)[] = []

  // 图片插入相关
  private imageInsertService: ImageInsertService
  private getImageOptions: () => ImageInsertOptions
  private getImageContext: () => ImageInsertContext

  // 回调函数，用于获取当前文件路径（由外部注入）
  private getCurrentFilePathFn: () => string | undefined
  private getCurrentFileDirFn: () => string | undefined

  constructor(
    getCurrentFilePath: () => string | undefined,
    getCurrentFileDir: () => string | undefined,
    imageInsertService: ImageInsertService,
    getImageOptions: () => ImageInsertOptions,
    getImageContext: () => ImageInsertContext
  ) {
    this.getCurrentFilePathFn = getCurrentFilePath
    this.getCurrentFileDirFn = getCurrentFileDir
    this.imageInsertService = imageInsertService
    this.getImageOptions = getImageOptions
    this.getImageContext = getImageContext
  }

  // ============================================================
  // 生命周期
  // ============================================================

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    if (!container) {
      console.error('[MilkdownAdapter] Container is undefined, cannot initialize')
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

    this.crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(
          debounce((...args: unknown[]) => {
            const markdown = args[1] as string
            this.handleMarkdownUpdate(markdown)
          }, MARKDOWN_UPDATE_DEBOUNCE_MS)
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

    try {
      await this.crepe.create()
    } catch (error) {
      console.error('[MilkdownAdapter] crepe.create() failed:', error)
      throw error
    }

    this.isInitialized = true
    const initTime = performance.now() - startTime
    console.log('[MilkdownAdapter] Initialized in', initTime.toFixed(2), 'ms')
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
    this.contentChangeCallbacks = []
    this.cursorChangeCallbacks = []
  }

  isReady(): boolean {
    return this.isInitialized && this.crepe !== null
  }

  // ============================================================
  // 内容操作
  // ============================================================

  getMarkdown(): string {
    if (!this.crepe || !this.isInitialized) {
      console.warn('[MilkdownAdapter] Cannot get markdown: Crepe not initialized')
      return this.content
    }

    try {
      const markdown = this.crepe.getMarkdown()
      return markdown || this.content
    } catch (error) {
      console.error('[MilkdownAdapter] Failed to get markdown:', error)
      return this.content
    }
  }

  async setMarkdown(content: string): Promise<void> {
    if (!this.crepe) {
      console.warn('[MilkdownAdapter] Cannot set markdown: Crepe not initialized')
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
      // 使用官方 replaceAll 宏，内部封装了 parserCtx + editorViewCtx + Slice 操作
      this.crepe.editor.action(replaceAll(content))

      const setTime = performance.now() - startTime
      console.log('[MilkdownAdapter] setMarkdown took', setTime.toFixed(2), 'ms')

      if (this.currentTabId) {
        this.contentCache.set(this.currentTabId, content)
      }
    } catch (error) {
      console.error('[MilkdownAdapter] Failed to set markdown:', error)
    } finally {
      this.isUpdatingContent = false
    }
  }

  getHTML(): string {
    if (!this.crepe || !this.isInitialized) {
      console.warn('[MilkdownAdapter] Cannot get HTML: Crepe not initialized')
      return ''
    }

    try {
      // 使用官方 getHTML 宏
      return this.crepe.editor.action(getHTML())
    } catch (error) {
      console.error('[MilkdownAdapter] Failed to get HTML:', error)
      return ''
    }
  }

  // 插入图片（Markdown 语法）
  insertImage(imageUrl: string, altText: string): void {
    if (!this.crepe || !this.isInitialized) {
      console.warn('[MilkdownAdapter] Cannot insert image: Crepe not initialized')
      return
    }
    const imageMarkdown = `![${altText || 'image'}](${imageUrl})`
    this.crepe.editor.action(insert(imageMarkdown, true))
  }

  // ============================================================
  // 视图模式
  // ============================================================

  setViewMode(mode: ViewMode): void {
    this.currentMode = mode

    if (this.currentTabId) {
      // 通知外部 Store 更新（通过事件总线或回调）
      // 这里不直接依赖 Store，由上层通过事件监听处理
    }
  }

  getViewMode(): ViewMode {
    return this.currentMode
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.activeEditor
  }

  getView(): any | null {
    if (!this.crepe || !this.isInitialized) return null

    let view: any = null
    this.crepe.editor.action((ctx) => {
      const proseView = ctx.get(editorViewCtx)
      if (proseView) {
        view = proseView
      }
    })
    return view
  }

  // ============================================================
  // 导航
  // ============================================================

  scrollToHeading(pos: number): void {
    if (!this.crepe || !this.isInitialized) return

    if (pos === undefined || pos < 0) {
      console.warn('[MilkdownAdapter] scrollToHeading: pos is required but not provided')
      return
    }

    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const targetPos = pos

        const resolvedPos = view.state.doc.resolve(targetPos)
        const tr = view.state.tr
          .setSelection(ProseSelection.near(resolvedPos, 1))
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
              behavior: 'smooth',
            })
          } catch (scrollError) {
            console.error('[MilkdownAdapter] Smooth scroll error:', scrollError)
          }
        }, SCROLL_DOM_SYNC_DELAY_MS)

        const { from, to } = view.state.selection
        this.emitCursorChange(from, to)
      } catch (error) {
        console.error('[MilkdownAdapter] scrollToHeading error:', error)
      }
    })
  }

  // ============================================================
  // 事件订阅
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
        console.error('[MilkdownAdapter] contentChange callback error:', e)
      }
    }
  }

  private emitCursorChange(from: number, to: number): void {
    for (const cb of this.cursorChangeCallbacks) {
      try {
        cb(from, to)
      } catch (e) {
        console.error('[MilkdownAdapter] cursorChange callback error:', e)
      }
    }
  }

  // ============================================================
  // 状态查询
  // ============================================================

  getSelection(): Selection | null {
    if (!this.crepe || !this.isInitialized) return null

    let selection: Selection | null = null
    this.crepe.editor.action((ctx) => {
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

  getHeadings(): Heading[] {
    if (!this.crepe || !this.isInitialized) return []

    const headings: Heading[] = []
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
              line,
              pos,
            })
          }
        })
      } catch (error) {
        console.error('[MilkdownAdapter] Failed to get headings:', error)
      }
    })

    return headings
  }

  // ============================================================
  // 内部方法
  // ============================================================

  private handleMarkdownUpdate(markdown: string): void {
    console.log('[MilkdownAdapter] handleMarkdownUpdate called', {
      isUpdatingContent: this.isUpdatingContent,
      contentEqual: this.content === markdown,
      activeEditor: this.activeEditor,
      currentTabId: this.currentTabId,
      markdownLength: markdown.length
    })
    
    if (this.isUpdatingContent) return
    if (this.content === markdown) return
    if (this.activeEditor === 'codemirror') return

    this.content = markdown

    if (this.currentTabId) {
      const fileDir = this.getCurrentFileDirFn()
      const savedMarkdown = fileDir
        ? this.convertFileUrlsToRelative(markdown, fileDir)
        : markdown

      this.emitContentChange(savedMarkdown)
      this.contentCache.set(this.currentTabId, savedMarkdown)
    }

    // 发布到事件总线（由外层订阅处理）
    this.emitContentChange(markdown)
  }

  private convertFileUrlsToRelative(markdown: string, fileDir: string): string {
    // 简化版：实际项目中使用 @/services/image/strategies/localImageProtocol 的 convertFileUrlsToRelative
    return markdown.replace(/\(file:\/\/\/([^)]+)\)/g, (match, url) => {
      try {
        const absolutePath = decodeURIComponent(url).replace(/\\/g, '/')
        const relative = this.makeRelativePath(fileDir, absolutePath)
        return `(${relative})`
      } catch {
        return match
      }
    })
  }

  private makeRelativePath(from: string, to: string): string {
    const fromParts = from.split('/').filter(Boolean)
    const toParts = to.split('/').filter(Boolean)

    let i = 0
    while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
      i++
    }

    const upCount = fromParts.length - i
    const up = '../'.repeat(upCount)
    const down = toParts.slice(i).join('/')

    return up + down
  }

  private isDarkMode(): boolean {
    // 简化版：实际应从 Preferences 获取
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  }

  // ============================================================
  // 缓存管理
  // ============================================================

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