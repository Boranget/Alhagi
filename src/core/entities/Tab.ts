import type { ViewMode, FileType, EditorSpecificState } from '@shared/types'

export interface TabProps {
  id: string
  filePath: string | null
  content: string
  isDirty: boolean
  title: string
  viewMode: ViewMode
  splitRatio: number
  fileType: FileType
  createdAt: number
  lastModified: number
  lastSaved: number | null
  cursor?: { from: number; to: number }
  scrollTop?: number
  crepe: EditorSpecificState
  codeMirror: EditorSpecificState
  viewerState?: Record<string, unknown>
}

export class Tab {
  public readonly id: string
  public filePath: string | null
  public content: string
  public isDirty: boolean
  public title: string
  public viewMode: ViewMode
  public splitRatio: number
  public fileType: FileType
  public createdAt: number
  public lastModified: number
  public lastSaved: number | null
  public cursor?: { from: number; to: number }
  public scrollTop?: number
  public crepe: EditorSpecificState
  public codeMirror: EditorSpecificState
  public viewerState?: Record<string, unknown>

  constructor(props: TabProps) {
    this.id = props.id
    this.filePath = props.filePath
    this.content = props.content
    this.isDirty = props.isDirty
    this.title = props.title
    this.viewMode = props.viewMode
    this.splitRatio = props.splitRatio
    this.fileType = props.fileType
    this.createdAt = props.createdAt
    this.lastModified = props.lastModified
    this.lastSaved = props.lastSaved
    this.cursor = props.cursor
    this.scrollTop = props.scrollTop
    this.crepe = props.crepe
    this.codeMirror = props.codeMirror
    this.viewerState = props.viewerState
  }

  static create(options: CreateTabOptions): Tab {
    const now = Date.now()
    const defaultEditorState: EditorSpecificState = {
      cursor: { from: 0, to: 0 },
      scrollTop: 0,
      undoStack: [],
      redoStack: [],
    }

    return new Tab({
      id: generateId(),
      filePath: options.filePath || null,
      content: options.content || '',
      isDirty: false,
      title: options.title || '无标题',
      viewMode: options.viewMode || 'wysiwyg',
      splitRatio: options.splitRatio || 1,
      fileType: options.fileType || 'markdown',
      createdAt: now,
      lastModified: now,
      lastSaved: null,
      crepe: { ...defaultEditorState },
      codeMirror: { ...defaultEditorState },
    })
  }

  markDirty(): void {
    this.isDirty = true
    this.lastModified = Date.now()
  }

  markClean(): void {
    this.isDirty = false
    this.lastSaved = Date.now()
  }

  updateContent(content: string): void {
    this.content = content
    this.lastModified = Date.now()
    this.markDirty()
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode
  }

  setSplitRatio(ratio: number): void {
    this.splitRatio = Math.max(0.1, Math.min(0.9, ratio))
  }

  toProps(): TabProps {
    return {
      id: this.id,
      filePath: this.filePath,
      content: this.content,
      isDirty: this.isDirty,
      title: this.title,
      viewMode: this.viewMode,
      splitRatio: this.splitRatio,
      fileType: this.fileType,
      createdAt: this.createdAt,
      lastModified: this.lastModified,
      lastSaved: this.lastSaved,
      cursor: this.cursor,
      scrollTop: this.scrollTop,
      crepe: this.crepe,
      codeMirror: this.codeMirror,
      viewerState: this.viewerState,
    }
  }
}

export interface CreateTabOptions {
  filePath?: string
  content?: string
  title?: string
  viewMode?: ViewMode
  fileType?: FileType
  splitRatio?: number
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
