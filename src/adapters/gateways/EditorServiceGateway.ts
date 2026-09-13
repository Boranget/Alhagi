import type { IEditorService, Heading } from '@core/interfaces/services/IEditorService'
import type { ViewMode } from '@shared/types'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'

export class EditorServiceGateway implements IEditorService {
  private manager = useCrepeEditorManager()

  async init(container: HTMLElement, content: string, tabId: string): Promise<void> {
    await this.manager.init(container, content, tabId)
  }

  async destroy(): Promise<void> {
    await this.manager.destroy()
  }

  isReady(): boolean {
    return this.manager.isReady()
  }

  getMarkdown(): string {
    return this.manager.getMarkdown()
  }

  async setMarkdown(content: string): Promise<void> {
    await this.manager.setMarkdown(content)
  }

  getHTML(): string {
    return this.manager.getHTML()
  }

  getView(): unknown {
    return this.manager.getView()
  }

  getCrepe(): unknown {
    return (this.manager as any).crepe
  }

  getCommands(): unknown {
    return this.manager.commands
  }

  setViewMode(mode: ViewMode): void {
    this.manager.setViewMode(mode)
  }

  getViewMode(): ViewMode {
    return this.manager.getViewMode()
  }

  onCursorChange(handler: (from: number, to: number) => void): () => void {
    this.manager.onCursorChange(handler)
    return () => {
      this.manager.onCursorChange(() => {})
    }
  }

  getHeadingsWithPos(): Heading[] {
    return this.manager.getHeadingsWithPos().map(h => ({
      text: h.text,
      level: h.level,
      line: h.line,
      pos: h.pos ?? 0,
    }))
  }

  scrollToHeading(text: string, line: number, pos?: number): void {
    this.manager.scrollToHeading(text, line, pos)
  }

  getCachedContent(tabId: string): string | undefined {
    return this.manager.getCachedContent(tabId)
  }

  setCachedContent(tabId: string, content: string): void {
    this.manager.setCachedContent(tabId, content)
  }

  clearCache(): void {
    this.manager.clearCache()
  }

  updateTheme(): void {
    this.manager.updateTheme()
  }

  switchToTab(tabId: string): void {
    this.manager.switchToTab(tabId)
  }

  setActiveEditor(editor: 'crepe' | 'codemirror' | null): void {
    this.manager.setActiveEditor(editor)
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.manager.getActiveEditor()
  }

  getCurrentCursorLine(): number | null {
    return this.manager.getCurrentCursorLine()
  }
}

let instance: EditorServiceGateway | null = null

export function useEditorServiceGateway(): EditorServiceGateway {
  if (!instance) {
    instance = new EditorServiceGateway()
  }
  return instance
}
