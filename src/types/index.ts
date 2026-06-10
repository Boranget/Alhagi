import { FileTreeNode, DirectoryEntry, RecentFile, RecentFolder, ElectronAPI, LineEnding, SearchResult, SearchOptions, DetachedTabData } from '@electron-protocol/index'

export type { ElectronAPI, LineEnding, SearchResult, SearchOptions, DetachedTabData }

export interface EditorSpecificState {
  cursor: {
    from: number
    to: number
  }
  scrollTop: number
  undoStack: HistoryItem[]
  redoStack: HistoryItem[]
}

export interface TabState {
  id: string
  filePath: string | null
  content: string
  isDirty: boolean
  title: string
  viewMode: ViewMode
  fileType: FileType
  createdAt: number
  lastModified: number
  lastSaved: number | null
  /**
   * 通用光标位置快照（与具体编辑器无关）。
   * 由编辑器在 CURSOR_CHANGED 事件后写入，会话保存时序列化；
   * 编辑器自身的精细光标/历史栈存于 crepe/codeMirror 嵌套字段。
   */
  cursor?: { from: number; to: number }
  /** 通用滚动位置快照，语义同 cursor */
  scrollTop?: number
  crepe: EditorSpecificState
  codeMirror: EditorSpecificState
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

export type SidebarView = 'files' | 'recent' | 'search' | 'outline'

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
  // Tab相关事件
  'app:tab:created': { tabId: string; tab: TabState }
  'app:tab:closed': { tabId: string; tab?: TabState }
  'app:tab:switched': { tabId: string; previousTabId?: string }
  'app:tab:updated': { tabId: string; updates: Partial<TabState> }

  // 文件相关事件
  'app:file:opened': { filePath: string; tabId: string }
  'app:file:saved': { filePath: string; tabId: string }
  'app:folder:opened': { folderPath: string }

  // 编辑器相关事件
  'app:editor:ready': { tabId?: string | null }
  'app:editor:destroyed': { tabId?: string | null }
  'app:view-mode-changed': ViewMode
  'app:theme:changed': Theme

  // 编辑器核心事件
  'editor:active-editor-changed': { editor: 'crepe' | 'codemirror' | null }
  'editor:content:changed': { content: string; tabId: string }
  'editor:cursor:changed': { from: number; to: number; tabId: string }
  'editor:undo': undefined
  'editor:redo': undefined

  // UI事件
  'app:capture-screen': undefined
  'app:open-settings': undefined
  'app:show-command-palette': undefined
  'app:show-shortcuts': undefined
  'app:sidebar:view-changed': SidebarView

  // 视图模式事件
  'app:view-mode-change': { mode: ViewMode }

  // 跨窗口标签操作（由 ElectronEventHandler 从主进程通道转发到这里）
  /**
   * 主进程通知本窗口"有标签从其他窗口分离/合并过来"。
   * 触发场景：用户在另一个窗口把标签拖到本窗口边缘，主进程通过
   * IPC TAB.MERGE 转发 tabData 到本窗口。
   */
  'app:tab-merge-requested': { tabData: DetachedTabData }
  'app:tab-detached': { tabData: DetachedTabData }
  'app:focus-tab-for-file': { filePath: string }
}

export type AppEventName = keyof AppEventPayloads

export type EventCallback<T = unknown> = (payload: T) => void

export interface Subscription<E extends AppEventName = AppEventName> {
  event: E
  callback: EventCallback<AppEventPayloads[E]>
}

export interface EventBus {
  on<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): () => void
  off<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void
  emit<E extends AppEventName>(event: E, payload?: AppEventPayloads[E]): void
  once<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void
  subscribe<E extends AppEventName>(subscriptions: Record<E, EventCallback<AppEventPayloads[E]>>): () => void
  clear(): void
  hasListeners(event: AppEventName): boolean
  getListenerCount(event: AppEventName): number
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

// ========== 拖放相关类型定义 ==========

/**
 * 拖放的标签信息
 * 用于标识正在被拖放的标签及其所属窗口
 */
export interface DraggedTabIdentifier {
  readonly tabId: string
  readonly windowId: number
}

/**
 * 拖放的标签组信息
 * 用于整组标签拖放操作
 */
export interface DraggedTabGroupIdentifier {
  readonly windowId: number
}

/**
 * 拖放操作的目标类型
 * - none: 无有效目标
 * - tab: 拖放到另一个标签
 * - windowEdge: 拖放到窗口边缘（用于拆分窗口）
 * - outsideWindow: 拖放到窗口外部（用于创建新窗口）
 */
export type DropTargetType = 'none' | 'tab' | 'windowEdge' | 'outsideWindow'

/**
 * 拖放状态接口
 * 跟踪整个拖放操作的状态信息
 */
export interface DragDropState {
  sourceTabId: string | null
  targetType: DropTargetType
  targetTabId: string | null
  targetWindowId: number | null
  windowEdgeDirection: 'left' | 'right' | null
  insertIndex: number
  mousePosition: { x: number, y: number }
  isNewWindowOperation: boolean
}

/**
 * 窗口信息接口
 * 包含窗口的基本信息
 */
export interface WindowInfo {
  id: number
  title: string
  bounds: { x: number; y: number; width: number; height: number }
}

/**
 * 新建窗口选项
 * 用于控制新窗口的创建参数
 */
export interface OpenWindowOptions {
  bounds?: { x: number; y: number; width?: number; height?: number }
  tabData?: DetachedTabData
}

/**
 * 合并标签选项
 * 用于将分离的标签合并到指定窗口
 */
export interface MergeTabOptions {
  tabData: DetachedTabData
  targetWindowId: number
  insertIndex?: number
}
