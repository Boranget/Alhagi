import type { ViewMode } from '@shared/types'

export interface EditorStateProps {
  isReady: boolean
  activeEditor: 'crepe' | 'codemirror' | null
  cursorPosition: { from: number; to: number }
  viewMode: ViewMode
  content: string
  tabId: string | null
}

export class EditorState {
  public isReady: boolean
  public activeEditor: 'crepe' | 'codemirror' | null
  public cursorPosition: { from: number; to: number }
  public viewMode: ViewMode
  public content: string
  public tabId: string | null

  constructor(props: EditorStateProps) {
    this.isReady = props.isReady
    this.activeEditor = props.activeEditor
    this.cursorPosition = props.cursorPosition
    this.viewMode = props.viewMode
    this.content = props.content
    this.tabId = props.tabId
  }

  static create(): EditorState {
    return new EditorState({
      isReady: false,
      activeEditor: null,
      cursorPosition: { from: 0, to: 0 },
      viewMode: 'wysiwyg',
      content: '',
      tabId: null,
    })
  }

  setReady(ready: boolean): void {
    this.isReady = ready
  }

  setActiveEditor(editor: 'crepe' | 'codemirror' | null): void {
    this.activeEditor = editor
  }

  updateCursorPosition(from: number, to: number): void {
    this.cursorPosition = { from, to }
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode
  }

  setContent(content: string): void {
    this.content = content
  }

  setTabId(tabId: string | null): void {
    this.tabId = tabId
  }

  reset(): void {
    this.isReady = false
    this.activeEditor = null
    this.cursorPosition = { from: 0, to: 0 }
    this.content = ''
    this.tabId = null
  }
}
