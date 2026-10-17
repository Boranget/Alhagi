// ============================================================
// MilkdownAdapter — Milkdown/Crepe 编辑器适配器（多实例版）
// ============================================================
//
// 实现 IEditorProvider 接口，封装所有 Milkdown/Crepe 特定逻辑。
// 使用 EditorPool 管理每个 Tab 独立的 Crepe + CodeMirror 实例。

import { EditorPool } from './EditorPool'
import { MilkdownCommands } from './MilkdownCommands'
import { insert } from '@milkdown/kit/utils'
import type { ViewMode } from '@shared/types'
import type { HeadingItem } from '@/utils/headings'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'
import type { IEditorProvider, Selection, Heading } from '@core/domain/ports/IEditorProvider'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { SearchService } from '@/services/search/types'
import type { EditorView as ProseMirrorEditorView } from '@milkdown/kit/prose/view'

export class MilkdownAdapter implements IEditorProvider {
  private pool: EditorPool
  private commands: MilkdownCommands

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
    getImageContext: () => ImageInsertContext,
    isFocusMode: () => boolean,
    tabRepository: ITabRepository
  ) {
    this.getCurrentFilePathFn = getCurrentFilePath
    this.getCurrentFileDirFn = getCurrentFileDir
    this.imageInsertService = imageInsertService
    this.getImageOptions = getImageOptions
    this.getImageContext = getImageContext

    // 立即创建 pool（不依赖 DOM）
    this.pool = new EditorPool(
      getCurrentFilePath,
      getCurrentFileDir,
      imageInsertService,
      getImageOptions,
      getImageContext,
      () => this.isDarkMode(),
      isFocusMode,
      tabRepository
    )

    this.commands = new MilkdownCommands(() => this.pool.getActiveCrepe())
  }

  // ============================================================
  // 生命周期
  // ============================================================

  async initWrapper(wrapper: HTMLElement): Promise<void> {
    this.pool.initWrapper(wrapper)
  }

  async detach(): Promise<void> {
    await this.pool.detach()
  }

  async destroy(): Promise<void> {
    await this.pool.destroyAll()
  }

  isReady(tabId?: string): boolean {
    return this.pool.isReady(tabId)
  }

  // ============================================================
  // Tab 管理（多实例）
  // ============================================================

  async createTab(tabId: string, content: string, viewMode: ViewMode = 'wysiwyg'): Promise<void> {
    await this.pool.createTab(tabId, content, viewMode)
  }

  async destroyTab(tabId: string): Promise<void> {
    await this.pool.destroyTab(tabId)
  }

  switchTab(tabId: string): void {
    this.pool.showTab(tabId)
  }

  hasTab(tabId: string): boolean {
    return this.pool.hasTab(tabId)
  }

  // ============================================================
  // 内容操作
  // ============================================================

  getMarkdown(tabId?: string): string {
    return this.pool.getMarkdown(tabId)
  }

  getHTML(tabId?: string): string {
    return this.pool.getHTML(tabId)
  }

  // ============================================================
  // 视图模式
  // ============================================================

  setViewMode(mode: ViewMode): void {
    const activeTabId = this.pool.getActiveTabId()
    if (activeTabId) {
      this.pool.setViewMode(activeTabId, mode)
    }
  }

  setTabViewMode(tabId: string, mode: ViewMode): void {
    this.pool.setViewMode(tabId, mode)
  }

  getViewMode(): ViewMode {
    const activeTabId = this.pool.getActiveTabId()
    if (!activeTabId) return 'wysiwyg'
    const instance = this.pool.getInstance(activeTabId)
    return instance?.viewMode ?? 'wysiwyg'
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    const mode = this.getViewMode()
    if (mode === 'source') return 'codemirror'
    return 'crepe'
  }

  getScrollContainer(): HTMLElement | null {
    return this.pool.getScrollContainer()
  }

  getCursorViewportY(): number | null {
    return this.pool.getCursorViewportY()
  }

  setEditorFocusMode(enabled: boolean): void {
    this.pool.setEditorFocusMode(enabled)
  }

  getCommands(): MilkdownCommands {
    return this.commands
  }

  getView(): ProseMirrorEditorView | null {
    return this.pool.getView()
  }

  // ============================================================
  // 导航
  // ============================================================

  scrollToHeading(pos: number): void {
    this.pool.scrollToHeading(pos)
  }

  // ============================================================
  // 事件订阅
  // ============================================================

  onContentChange(callback: (markdown: string) => void): () => void {
    return this.pool.onContentChange(callback)
  }

  onCursorChange(callback: (from: number, to: number) => void): () => void {
    return this.pool.onCursorChange(callback)
  }

  // ============================================================
  // 历史 / 焦点 / 选区
  // ============================================================

  undo(): void {
    this.pool.undo()
  }

  redo(): void {
    this.pool.redo()
  }

  focus(): void {
    this.pool.focus()
  }

  selectAll(): void {
    this.pool.selectAll()
  }

  insertText(text: string): void {
    this.pool.insertText(text)
  }

  // ============================================================
  // 状态查询
  // ============================================================

  getSelection(): Selection | null {
    return this.pool.getSelection()
  }

  getHeadings(): Heading[] {
    return this.pool.getHeadings()
  }

  // ============================================================
  // 搜索服务
  // ============================================================

  getCMSearchService(tabId?: string): SearchService | null {
    return this.pool.getCMSearchService(tabId)
  }

  // ============================================================
  // 主题
  // ============================================================

  async updateTheme(isDark: boolean): Promise<void> {
    await this.pool.updateTheme(isDark)
  }

  // ============================================================
  // 缓存管理（向后兼容）
  // ============================================================

  getCachedContent(tabId: string): string | undefined {
    // 多实例架构下，内容直接保存在实例中
    const instance = this.pool.getInstance(tabId)
    return instance?.content
  }

  setCachedContent(tabId: string, content: string): void {
    // 多实例架构下，内容直接保存在实例中
    const instance = this.pool.getInstance(tabId)
    if (instance) {
      instance.content = content
    }
  }

  clearCache(): void {
    // 多实例架构下，缓存由实例自行管理
  }

  // ============================================================
  // 图片操作
  // ============================================================

  insertImage(imageUrl: string, altText: string): void {
    const activeTabId = this.pool.getActiveTabId()
    if (!activeTabId) return

    const instance = this.pool.getInstance(activeTabId)
    if (!instance?.crepe) return

    try {
      const imageMarkdown = `![${altText || 'image'}](${imageUrl})`
      instance.crepe.editor.action(insert(imageMarkdown, true))
    } catch (error) {
      console.error('[MilkdownAdapter] Failed to insert image:', error)
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  private isDarkMode(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  }
}
