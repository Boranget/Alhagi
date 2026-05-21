import { FileTreeNode, DirectoryEntry, RecentFile, RecentFolder, ElectronAPI, LineEnding, SearchResult, SearchOptions } from '../../electron-protocol/index'

export type { ElectronAPI, LineEnding, SearchResult, SearchOptions }

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
  fileType: FileType
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

export type FileType = 'editor' | 'image' | 'unsupported'

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

export type FileTreeNodeType = FileTreeNode

export type { DirectoryEntry, RecentFile, RecentFolder }

export interface AppEventPayloads {
  'app:tab:created': { tabId: string; tab: TabState }
  'app:tab:closed': { tabId: string; tab?: TabState }
  'app:tab:switched': { tabId: string; previousTabId?: string }
  'app:tab:updated': { tabId: string; updates: Partial<TabState> }
  'app:file:opened': { filePath: string; tabId: string }
  'app:file:saved': { filePath: string; tabId: string }
  'app:folder:opened': { folderPath: string }
  'app:editor:ready': { tabId?: string | null }
  'app:editor:destroyed': { tabId?: string | null }
  'app:view-mode-changed': ViewMode
  'app:sidebar:view-changed': SidebarView
  'app:theme:changed': Theme
  'app:window:resized': { width: number; height: number }
  'app:window:maximized': undefined
  'app:window:minimized': undefined
  'app:preferences:updated': undefined
  'editor:active-editor-changed': { editor: 'crepe' | 'codemirror' | null }
'editor:content:changed': { content: string; tabId: string }
  'editor:cursor:changed': { from: number; to: number; tabId: string }
  'editor:selection:changed': { from: number; to: number; tabId: string }
  'editor:scroll:changed': { scrollTop: number; tabId: string }
  'editor:scroll-to-heading': { slug: string; text: string; line: number }
}

export type AppEventName = keyof AppEventPayloads

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
