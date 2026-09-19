// ============================================================
// MilkdownAdapter — Milkdown/Crepe 编辑器适配器（多实例版）
// ============================================================
//
// 实现 IEditorProvider 接口，封装所有 Milkdown/Crepe 特定逻辑。
// 使用 EditorPool 管理每个 Tab 独立的 Crepe + CodeMirror 实例。

import { EditorPool } from './EditorPool'
import type { ViewMode } from '@shared/types'
import type { HeadingItem } from '@/utils/headings'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'
import type { IEditorProvider, Selection, Heading } from '@core/domain/ports/IEditorProvider'
import type { SearchService } from '@/services/search/types'

export class MilkdownAdapter implements IEditorProvider {
  private pool: EditorPool
  private currentMode: ViewMode = 'wysiwyg'
  private activeEditor: 'crepe' | 'codemirror' | null = null

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

    // 立即创建 pool（不依赖 DOM）
    this.pool = new EditorPool(
      getCurrentFilePath,
      getCurrentFileDir,
      imageInsertService,
      getImageOptions,
      getImageContext,
      () => this.isDarkMode()
    )
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

  /** @deprecated 使用 createTab + switchTab 替代 */
  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    // 向后兼容：将旧的 init 调用转换为新架构
    if (tabId && !this.pool.hasTab(tabId)) {
      await this.pool.createTab(tabId, initialContent, this.currentMode)
      this.pool.showTab(tabId)
    }
  }

  async destroy(): Promise<void> {
    await this.pool.destroyAll()
    this.currentMode = 'wysiwyg'
    this.activeEditor = null
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

  /** @deprecated 每个 tab 独立管理内容，无需全局设置 */
  async setMarkdown(content: string): Promise<void> {
    // 向后兼容：更新当前活动 tab 的内容
    const activeTabId = this.pool.getActiveTabId()
    if (!activeTabId) return

    const instance = this.pool.getInstance(activeTabId)
    if (!instance?.crepe) return

    try {
      const { replaceAll } = require('@milkdown/kit/utils')
      instance.crepe.editor.action(replaceAll(content))
      instance.content = content
    } catch (error) {
      console.error('[MilkdownAdapter] Failed to set markdown:', error)
    }
  }

  // ============================================================
  // 视图模式
  // ============================================================

  setViewMode(mode: ViewMode): void {
    this.currentMode = mode
    const activeTabId = this.pool.getActiveTabId()
    if (activeTabId) {
      this.pool.setViewMode(activeTabId, mode)
    }
  }

  setTabViewMode(tabId: string, mode: ViewMode): void {
    this.pool.setViewMode(tabId, mode)
  }

  getViewMode(): ViewMode {
    return this.currentMode
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.activeEditor
  }

  getView(): any | null {
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
  // 状态查询
  // ============================================================

  getSelection(): Selection | null {
    return this.pool.getSelection()
  }

  getHeadings(): Heading[] {
    return this.pool.getHeadings()
  }

  // ============================================================
  // Tab 管理（向后兼容）
  // ============================================================

  /** @deprecated 使用 switchTab 替代 */
  setCurrentTabId(tabId: string): void {
    this.switchTab(tabId)
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
      const { insert } = require('@milkdown/kit/utils')
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
