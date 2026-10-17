import type { ViewMode } from '@shared/types'
import type { SearchService } from '@/services/search/types'
import type { EditorView } from '@milkdown/kit/prose/view'

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
  getScrollContainer(): HTMLElement | null
  /** 当前光标在视口坐标系中的 Y（px）；无实例/无光标时 null。测量细节归适配器 */
  getCursorViewportY(): number | null
  /** 焦点模式 meta 派发（PM 插件 Decoration 开关），细节归适配器 */
  setEditorFocusMode(enabled: boolean): void
  scrollToHeading(pos: number): void
  getHeadings(): EditorHeading[]
  getSelection(): EditorSelection | null
  getActiveEditor(): 'crepe' | 'codemirror' | null
  getView(): EditorView | null
  getCMSearchService(tabId?: string): SearchService | null
  undo(): void
  redo(): void
  focus(): void
  selectAll(): void
  insertText(text: string): void
}
