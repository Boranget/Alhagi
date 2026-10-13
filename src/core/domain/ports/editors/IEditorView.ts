import type { ViewMode } from '@shared/types'
import type { SearchService } from '@/services/search/types'

export interface EditorSelection {
  from: number
  to: number
}

export interface EditorHeading {
  text: string
  level: number
  slug: string
  line: number
  pos: number
}

export interface IEditorView {
  setViewMode(mode: ViewMode): void
  setTabViewMode(tabId: string, mode: ViewMode): void
  getViewMode(): ViewMode
  scrollToHeading(pos: number): void
  getHeadings(): EditorHeading[]
  getSelection(): EditorSelection | null
  getActiveEditor(): 'crepe' | 'codemirror' | null
  getView(): any | null
  getCMSearchService(tabId?: string): SearchService | null
  undo(): void
  redo(): void
  focus(): void
  selectAll(): void
  insertText(text: string): void
}
