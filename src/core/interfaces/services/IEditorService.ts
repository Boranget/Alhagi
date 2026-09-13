import type { ViewMode } from '@shared/types'

export interface Heading {
  text: string
  level: number
  line: number
  pos: number
}

export interface IEditorService {
  init(container: HTMLElement, content: string, tabId: string): Promise<void>
  destroy(): Promise<void>
  isReady(): boolean
  getMarkdown(): string
  setMarkdown(content: string): Promise<void>
  getHTML(): string
  getView(): unknown
  getCrepe(): unknown
  getCommands(): unknown
  setViewMode(mode: ViewMode): void
  getViewMode(): ViewMode
  onCursorChange(handler: (from: number, to: number) => void): () => void
  getHeadingsWithPos(): Heading[]
  scrollToHeading(text: string, line: number, pos?: number): void
  getCachedContent(tabId: string): string | undefined
  setCachedContent(tabId: string, content: string): void
  clearCache(): void
  updateTheme(): void
  switchToTab(tabId: string): void
  setActiveEditor(editor: 'crepe' | 'codemirror' | null): void
  getActiveEditor(): 'crepe' | 'codemirror' | null
  getCurrentCursorLine(): number | null
}
