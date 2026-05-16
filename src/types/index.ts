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

export type SidebarView = 'files' | 'recent' | 'search' | 'extensions' | 'settings'

export type Theme = 'light' | 'dark' | 'system'

export interface WindowState {
  windowId: string
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
  sidebarWidth: number
  sidebarCollapsed: boolean
  activeSidebarView: SidebarView
  showStatusBar: boolean
  theme: Theme
  editorFontSize: number
  editorFontFamily: string
  wordWrap: boolean
  autoSave: boolean
  autoSaveInterval: number
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

export interface FileTreeNodeType {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNodeType[]
  expanded?: boolean
  isDirty?: boolean
}

export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  lastModified: number
}

export interface RecentFile {
  filePath: string
  title: string
  lastOpened: number
  pinned: boolean
}

export interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; content: string } | null>
  saveFile: (filePath: string, content: string) => Promise<boolean>
  saveAsFile: (content: string, defaultPath?: string) => Promise<string | null>
  readFile: (filePath: string) => Promise<string>
  openFolder: () => Promise<{ path: string; tree: FileTreeNodeType[] } | null>
  readDirectory: (dirPath: string) => Promise<DirectoryEntry[]>
  createFile: (dirPath: string, fileName: string) => Promise<string | null>
  createDirectory: (dirPath: string, dirName: string) => Promise<string | null>
  deleteFile: (filePath: string) => Promise<boolean>
  renameFile: (oldPath: string, newName: string) => Promise<string | null>
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

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    editorInstance?: EditorInstance
  }
}
