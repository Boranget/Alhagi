// ============================================================
// Editor Store — 编辑器状态薄代理
// ============================================================
//
// 委托给 EditorServiceGateway (IEditorProvider)，不直接依赖 CrepeEditorManager。

import { defineStore } from 'pinia'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import type { ViewMode } from '@/types'

export const useEditorStore = defineStore('editor', () => {
  const gateway = getEditorServiceGateway()

  // 生命周期
  function destroy(): Promise<void> {
    return gateway.destroy()
  }

  function isReady(): boolean {
    return gateway.isReady()
  }

  // 内容操作
  function getMarkdown(): string {
    return gateway.getMarkdown()
  }

  function getHTML(): string {
    return gateway.getHTML()
  }

  // 视图模式
  function setViewMode(mode: ViewMode): void {
    gateway.setViewMode(mode)
  }

  function getViewMode(): ViewMode {
    return gateway.getViewMode()
  }

  // 编辑器类型
  function getActiveEditor(): 'crepe' | 'codemirror' | null {
    return gateway.getActiveEditor()
  }

  // 事件订阅
  function onContentChange(handler: (markdown: string) => void): () => void {
    return gateway.onContentChange(handler)
  }

  function onCursorChange(handler: (from: number, to: number) => void): () => void {
    return gateway.onCursorChange(handler)
  }

  // 状态查询
  function getHeadingsWithPos() {
    return gateway.getHeadings()
  }

  function scrollToHeading(pos: number): void {
    gateway.scrollToHeading(pos)
  }

  // 缓存管理
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

  return {
    destroy,
    isReady,
    getMarkdown,
    getHTML,
    setViewMode,
    getViewMode,
    getActiveEditor,
    onContentChange,
    onCursorChange,
    getHeadingsWithPos,
    scrollToHeading,
    getCachedContent,
    setCachedContent,
    clearCache,
    getView,
  }
})
