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
  moveFile: (sourcePath: string, targetDir: string) => Promise<string | null>
  copyFile: (sourcePath: string, targetDir: string) => Promise<string | null>
  selectDirectory: () => Promise<string | null>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  setAlwaysOnTop: (flag: boolean) => Promise<void>
  openNewWindow: (options: { type: string; tab?: Partial<TabState> }) => Promise<void>
  onNewFile: (callback: () => void) => void
  onOpenFile: (callback: () => void) => void
  onSave: (callback: () => void) => void
  onSaveAs: (callback: () => void) => void
  onViewMode: (callback: (mode: string) => void) => void
}

// ============ 事件类型定义 ============
export interface AppEventPayloads {
  'app:tab:created': { tabId: string; tab: TabState }
  'app:tab:closed': { tabId: string; tab?: TabState }
  'app:tab:switched': { tabId: string; previousTabId?: string }
  'app:tab:updated': { tabId: string; updates: Partial<TabState> }
  'app:file:opened': { filePath: string; tabId: string }
  'app:file:saved': { filePath: string; tabId: string }
  'app:editor:ready': { tabId?: string | null }
  'app:editor:destroyed': { tabId?: string | null }
  'app:sidebar:view-changed': SidebarView
  'app:theme:changed': Theme
  'app:window:resized': { width: number; height: number }
  'app:window:maximized': undefined
  'app:window:minimized': undefined
  'app:preferences:updated': undefined
  'editor:content:changed': { content: string; tabId: string }
  'editor:cursor:changed': { from: number; to: number; tabId: string }
  'editor:selection:changed': { from: number; to: number; tabId: string }
  'editor:scroll:changed': { scrollTop: number; tabId: string }
}

// 事件名称类型
export type AppEventName = keyof AppEventPayloads

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
