// ============================================================
// Editor Store — 编辑器状态薄代理
// ============================================================
//
// 委托给 EditorServiceGateway (IEditorProvider)，不直接依赖 CrepeEditorManager。

import { defineStore } from 'pinia'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import type { ViewMode } from '@/types'
import type { HeadingItem } from '@/utils/headings'

export const useEditorStore = defineStore('editor', () => {
  const gateway = getEditorServiceGateway()

  // ============================================================
  // 生命周期
  // ============================================================

  function init(container: HTMLElement, initialContent: string = '', tabId: string = ''): Promise<void> {
    return gateway.init(container, initialContent, tabId)
  }

  function destroy(): Promise<void> {
    return gateway.destroy()
  }

  function isReady(): boolean {
    return gateway.isReady()
  }

  // ============================================================
  // 内容操作
  // ============================================================

  function getMarkdown(): string {
    return gateway.getMarkdown()
  }

  function setMarkdown(content: string): Promise<void> {
    return gateway.setMarkdown(content)
  }

  function getHTML(): string {
    return gateway.getHTML()
  }

  // ============================================================
  // 视图模式
  // ============================================================

  function setViewMode(mode: ViewMode): void {
    gateway.setViewMode(mode)
  }

  function getViewMode(): ViewMode {
    return gateway.getViewMode()
  }

  // ============================================================
  // 标签切换（委托给 tabs store，保留兼容接口）
  // ============================================================

  function switchToTab(tabId: string): Promise<void> {
    // 实际逻辑在 tabs store + useAppContext 中
    // 这里保留空实现以兼容现有调用
    return Promise.resolve()
  }

  // ============================================================
  // 编辑器类型切换
  // ============================================================

  function setActiveEditor(editor: 'crepe' | 'codemirror' | null): void {
    // 由 EditorContainer 管理
  }

  function getActiveEditor(): 'crepe' | 'codemirror' | null {
    return gateway.getActiveEditor()
  }

  function onContentChange(handler: (markdown: string) => void): () => void {
    return gateway.onContentChange(handler)
  }

  // ============================================================
  // 事件订阅
  // ============================================================

  function onCursorChange(handler: (from: number, to: number) => void): () => void {
    return gateway.onCursorChange(handler)
  }

  // ============================================================
  // 状态查询
  // ============================================================

  function getCurrentCursorLine(): number {
    // 由 EditorContainer 通过 eventBus 获取
    return 0
  }

  function getHeadingsWithPos(): HeadingItem[] {
    return gateway.getHeadings().map(h => ({
      text: h.text,
      level: h.level,
      line: h.line,
      pos: h.pos,
      slug: '',
    }))
  }

  function scrollToHeading(text: string, line: number, pos?: number): void {
    if (pos !== undefined) {
      gateway.scrollToHeading(pos)
    }
  }

  // ============================================================
  // 缓存管理
  // ============================================================

  function getCachedContent(tabId: string): string | undefined {
    return gateway.getCachedContent(tabId)
  }

  function setCachedContent(tabId: string, content: string): void {
    gateway.setCachedContent(tabId, content)
  }

  function clearCache(): void {
    gateway.clearCache()
  }

  function getView() {
    return gateway.getView()
  }

  // ============================================================
  // 兼容性方法（标记废弃）
  // ============================================================

  /** @deprecated 请勿直接访问 Crepe 实例 */
  function getCrepe(): null {
    return null
  }

  /** @deprecated 请勿直接访问编辑器命令 */
  function getCommands(): null {
    return null
  }

  /** @deprecated 由 EditorContainer 管理主题更新 */
  function updateTheme(): Promise<void> {
    return Promise.resolve()
  }

  return {
    init,
    destroy,
    isReady,
    getMarkdown,
    setMarkdown,
    getHTML,
    setViewMode,
    getViewMode,
    switchToTab,
    setActiveEditor,
    getActiveEditor,
    onContentChange,
    getView: () => gateway.getView(),
    onCursorChange,
    getCurrentCursorLine,
    getHeadingsWithPos,
    scrollToHeading,
    getCachedContent,
    setCachedContent,
    clearCache,
    updateTheme,
    getCrepe,
    getCommands,
  }
})