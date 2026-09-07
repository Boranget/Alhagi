import { defineStore } from 'pinia'
import { useCrepeEditorManager, resetCrepeEditorManager } from '@/managers/crepeEditorManager'
import type { ViewMode } from '@/types'
import type { HeadingItem } from '@/utils/headings'
import type { Crepe } from '@milkdown/crepe'

export const useEditorStore = defineStore('editor', () => {
  const manager = useCrepeEditorManager()

  function init(container: HTMLElement, initialContent?: string, tabId?: string): Promise<void> {
    return manager.init(container, initialContent, tabId)
  }

  function destroy(): Promise<void> {
    return manager.destroy()
  }

  function isReady(): boolean {
    return manager.isReady()
  }

  function getMarkdown(): string {
    return manager.getMarkdown()
  }

  function setMarkdown(content: string): Promise<void> {
    return manager.setMarkdown(content)
  }

  function getHTML(): string {
    return manager.getHTML()
  }

  function setViewMode(mode: ViewMode): void {
    manager.setViewMode(mode)
  }

  function getViewMode(): ViewMode {
    return manager.getViewMode()
  }

  function switchToTab(tabId: string): Promise<void> {
    return manager.switchToTab(tabId)
  }

  function setActiveEditor(editor: 'crepe' | 'codemirror' | null): void {
    manager.setActiveEditor(editor)
  }

  function getActiveEditor(): 'crepe' | 'codemirror' | null {
    return manager.getActiveEditor()
  }

  function getView(): import('@milkdown/kit/prose/view').EditorView | null {
    return manager.getView()
  }

  function onCursorChange(handler: (from: number, to: number) => void): void {
    manager.onCursorChange(handler)
  }

  function getCurrentCursorLine(): number {
    return manager.getCurrentCursorLine()
  }

  function getHeadingsWithPos(): HeadingItem[] {
    return manager.getHeadingsWithPos()
  }

  function scrollToHeading(text: string, line: number, pos?: number): void {
    manager.scrollToHeading(text, line, pos)
  }

  function getCachedContent(tabId: string): string | undefined {
    return manager.getCachedContent(tabId)
  }

  function setCachedContent(tabId: string, content: string): void {
    manager.setCachedContent(tabId, content)
  }

  function clearCache(): void {
    manager.clearCache()
  }

  function updateTheme(): Promise<void> {
    return manager.updateTheme()
  }

  function getCrepe(): Crepe | null {
    return (manager as any).crepe ?? null
  }

  function getCommands() {
    return manager.commands
  }

  function $reset() {
    resetCrepeEditorManager()
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
    getView,
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
    $reset,
  }
})
