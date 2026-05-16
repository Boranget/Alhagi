export interface TabState {
  id: string
  filePath: string | null
  content: string
  isDirty: boolean
  title: string
  active: boolean
  cursor: {
    from: number
    to: number
  }
  scrollTop: number
  viewMode: ViewMode
  undoStack: HistoryItem[]
  redoStack: HistoryItem[]
  createdAt: number
  lastModified: number
  lastSaved: number | null
}

export interface HistoryItem {
  type: 'insert' | 'delete' | 'replace'
  from: number
  to: number
  content: string
  timestamp: number
}

export type ViewMode = 'wysiwyg' | 'source' | 'split'

export interface WindowState {
  windowId: string
  tabs: Map<string, TabState>
  activeTabId: string | null
  tabOrder: string[]
}

export interface EditorInstance {
  id: string
  content: string
  mode: ViewMode
  getContent: () => string
  setContent: (content: string) => void
  getCursor: () => { from: number; to: number }
  setCursor: (from: number, to: number) => void
  getScrollTop: () => number
  setScrollTop: (position: number) => void
  focus: () => void
  destroy: () => void
}

declare global {
  interface Window {
    electronAPI?: {
      openFile: () => Promise<{ filePath: string; content: string } | null>
      saveFile: (filePath: string, content: string) => Promise<boolean>
      saveAsFile: (content: string, defaultPath?: string) => Promise<string | null>
      readFile: (filePath: string) => Promise<string>
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      setAlwaysOnTop: (flag: boolean) => Promise<void>
      onNewFile: (callback: () => void) => void
      onOpenFile: (callback: () => void) => void
      onSave: (callback: () => void) => void
      onSaveAs: (callback: () => void) => void
      onViewMode: (callback: (mode: string) => void) => void
    }
    editorInstance?: EditorInstance
  }
}
