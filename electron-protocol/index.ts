export enum IPCErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_SAVE_ERROR = 'FILE_SAVE_ERROR',
  FILE_DELETE_ERROR = 'FILE_DELETE_ERROR',
  FILE_RENAME_ERROR = 'FILE_RENAME_ERROR',
  FILE_MOVE_ERROR = 'FILE_MOVE_ERROR',
  FILE_COPY_ERROR = 'FILE_COPY_ERROR',
  FILE_CREATE_ERROR = 'FILE_CREATE_ERROR',
  DIRECTORY_READ_ERROR = 'DIRECTORY_READ_ERROR',
  DIRECTORY_CREATE_ERROR = 'DIRECTORY_CREATE_ERROR',
  DIALOG_CANCELLED = 'DIALOG_CANCELLED',
  INVALID_PATH = 'INVALID_PATH',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
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

export interface RecentFolder {
  folderPath: string
  name: string
  lastOpened: number
  pinned: boolean
}

export interface SearchResult {
  filePath: string
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

export interface SearchOptions {
  includePatterns?: string[]
  excludePatterns?: string[]
  caseSensitive?: boolean
  wholeWord?: boolean
  useRegex?: boolean
}

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

export function createSuccessResponse<T>(data: T): IPCResponse<T> {
  return {
    success: true,
    data
  }
}

export function createErrorResponse(
  code: IPCErrorCode,
  message: string
): IPCResponse<never> {
  return {
    success: false,
    error: {
      code,
      message
    }
  }
}

export function isSuccessResponse<T>(response: IPCResponse<T>): response is { success: true; data: T } {
  return response.success === true
}

export function isErrorResponse<T>(response: IPCResponse<T>): response is { success: false; error: { code: string; message: string } } {
  return response.success === false
}

// ========== IPC 通道名常量 ==========
export const IPC_CHANNELS = {
  FILE: {
    OPEN: 'file:open',
    SAVE: 'file:save',
    SAVE_AS: 'file:save-as',
    SAVE_BINARY: 'file:save-binary',
    READ: 'file:read',
    READ_BINARY: 'file:read-binary',
    OPEN_FOLDER: 'file:open-folder',
    READ_DIRECTORY: 'file:read-directory',
    CREATE: 'file:create',
    DELETE: 'file:delete',
    RENAME: 'file:rename',
    MOVE: 'file:move',
    COPY: 'file:copy',
    SEARCH_IN_DIRECTORY: 'file:search-in-directory',
    SHOW_IN_FOLDER: 'file:show-in-folder',
    GET_DOCUMENTS_DIRECTORY: 'file:get-documents-directory',
    ENSURE_DIRECTORY: 'file:ensure-directory'
  },
  DIALOG: {
    SELECT_DIRECTORY: 'dialog:select-directory'
  },
  WINDOW: {
    MINIMIZE: 'window:minimize',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close',
    SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
    OPEN_NEW_WINDOW: 'window:open-new-window',
    MERGE_TAB: 'window:merge-tab',
    GET_WINDOW_ID: 'window:get-window-id',
    LIST_WINDOWS: 'window:list-windows',
    GET_CURSOR_SCREEN_POINT: 'window:get-cursor-screen-point',
    GET_SCREEN_DISPLAY: 'window:get-screen-display',
    DRAG_START: 'window:drag-start',
    DRAG_END: 'window:drag-end',
    OPEN_DEV_TOOLS: 'window:open-dev-tools',
    FOCUS_WINDOW: 'window:focus-window',
    CHECK_FILE_OPEN: 'window:check-file-open',
    UPDATE_OPENED_FILES: 'window:update-opened-files',
    SET_ZOOM: 'window:set-zoom'
  }
} as const;

// ========== 菜单事件常量 ==========
export const MENU_EVENTS = {
  // 文件
  NEW_FILE: 'menu:new-file',
  NEW_WINDOW: 'menu:new-window',
  OPEN_FILE: 'menu:open-file',
  OPEN_FOLDER: 'menu:open-folder',
  SAVE: 'menu:save',
  SAVE_AS: 'menu:save-as',
  
  // 编辑
  EDIT_UNDO: 'menu:edit-undo',
  EDIT_REDO: 'menu:edit-redo',
  COPY_AS_MARKDOWN: 'menu:copy-as-markdown',
  COPY_AS_HTML: 'menu:copy-as-html',
  PASTE_AS_PLAIN: 'menu:paste-as-plain',
  CAPTURE_SCREEN: 'menu:capture-screen',
  
  // 段落
  PARAGRAPH_HEADING1: 'menu:paragraph-heading1',
  PARAGRAPH_HEADING2: 'menu:paragraph-heading2',
  PARAGRAPH_HEADING3: 'menu:paragraph-heading3',
  PARAGRAPH_PARAGRAPH: 'menu:paragraph-paragraph',
  PARAGRAPH_QUOTE: 'menu:paragraph-quote',
  PARAGRAPH_BULLET_LIST: 'menu:paragraph-bullet-list',
  PARAGRAPH_ORDERED_LIST: 'menu:paragraph-ordered-list',
  PARAGRAPH_TASK_LIST: 'menu:paragraph-task-list',
  PARAGRAPH_CODE_BLOCK: 'menu:paragraph-code-block',
  PARAGRAPH_MATH_BLOCK: 'menu:paragraph-math-block',
  PARAGRAPH_HORIZONTAL_RULE: 'menu:paragraph-horizontal-rule',
  
  // 表格
  TABLE_INSERT: 'menu:table-insert',
  TABLE_INSERT_ROW_ABOVE: 'menu:table-insert-row-above',
  TABLE_INSERT_ROW_BELOW: 'menu:table-insert-row-below',
  TABLE_INSERT_COLUMN_LEFT: 'menu:table-insert-column-left',
  TABLE_INSERT_COLUMN_RIGHT: 'menu:table-insert-column-right',
  TABLE_DELETE_ROW: 'menu:table-delete-row',
  TABLE_DELETE_COLUMN: 'menu:table-delete-column',
  
  // 视图
  VIEW_MODE: 'menu:view-mode',
  TOGGLE_SIDEBAR: 'menu:toggle-sidebar',
  TOGGLE_TAB_BAR: 'menu:toggle-tab-bar',
  TOGGLE_STATUS_BAR: 'menu:toggle-status-bar',
  TOGGLE_STICKY_NOTE: 'menu:toggle-sticky-note',
  TOGGLE_IMMERSIVE: 'menu:toggle-immersive',
  TOGGLE_THEME: 'menu:toggle-theme',
  ZOOM_IN: 'menu:zoom-in',
  ZOOM_OUT: 'menu:zoom-out',
  ZOOM_RESET: 'menu:zoom-reset',
  
  // 导航
  NAVIGATION_QUICK_OPEN: 'menu:navigation-quick-open',
  NAVIGATION_GOTO_LINE: 'menu:navigation-goto-line',
  
  // 工具
  TOOLS_PREFERENCES: 'menu:tools-preferences',
  TOOLS_EXPORT: 'menu:tools-export',
  
  // 帮助
  HELP_SHORTCUTS: 'menu:help-shortcuts',
  HELP_ABOUT: 'menu:help-about',
  OPEN_SETTINGS: 'menu:open-settings'
} as const;

// ========== 文件类型常量 ==========
export const FILE_TYPES = {
  FILE: 'file',
  DIRECTORY: 'directory'
} as const;

// ========== 行尾符常量 ==========
export const LINE_ENDINGS = {
  LF: '\n',
  CRLF: '\r\n'
} as const;

export type LineEnding = keyof typeof LINE_ENDINGS;

/**
 * 转换文本的行尾符
 */
export function convertLineEndings(content: string, lineEnding: LineEnding): string {
  const targetEnding = LINE_ENDINGS[lineEnding]
  // 将所有行尾符统一转换为目标格式
  return content
    .replace(/\r\n/g, '\n')  // 先统一为 LF
    .replace(/\n/g, targetEnding)  // 再转换为目标格式
}

// ========== ElectronAPI 接口 ==========
export interface ElectronAPI {
  openFile: () => Promise<IPCResponse<{ filePath: string; content: string } | null>>
  saveFile: (filePath: string, content: string, lineEnding?: LineEnding) => Promise<IPCResponse<boolean>>
  saveAsFile: (content: string, defaultPath?: string, lineEnding?: LineEnding) => Promise<IPCResponse<string | null>>
  saveBinaryFile: (filePath: string, content: string) => Promise<IPCResponse<boolean>>
  readFile: (filePath: string) => Promise<IPCResponse<string>>
  readBinaryFile: (filePath: string) => Promise<IPCResponse<string>>
  openFolder: () => Promise<IPCResponse<{ path: string; tree: FileTreeNode[] } | null>>
  readDirectory: (dirPath: string) => Promise<IPCResponse<DirectoryEntry[]>>
  createFile: (dirPath: string, fileName: string) => Promise<IPCResponse<string | null>>
  createDirectory: (dirPath: string, dirName: string) => Promise<IPCResponse<string | null>>
  deleteFile: (filePath: string) => Promise<IPCResponse<boolean>>
  renameFile: (oldPath: string, newName: string) => Promise<IPCResponse<string | null>>
  moveFile: (sourcePath: string, targetDir: string) => Promise<IPCResponse<string | null>>
  copyFile: (sourcePath: string, targetDir: string) => Promise<IPCResponse<string | null>>
  selectDirectory: () => Promise<IPCResponse<string | null>>
  showInFolder: (filePath: string) => Promise<IPCResponse<boolean>>
  searchInDirectory: (dirPath: string, query: string, options?: SearchOptions) => Promise<IPCResponse<SearchResult[]>>
  getDocumentsDirectory: () => Promise<IPCResponse<string>>
  ensureDirectory: (dirPath: string) => Promise<IPCResponse<boolean>>
  minimize: () => Promise<IPCResponse<void>>
  maximize: () => Promise<IPCResponse<void>>
  close: () => Promise<IPCResponse<void>>
  setAlwaysOnTop: (flag: boolean) => Promise<IPCResponse<void>>
  getCursorScreenPoint: () => Promise<IPCResponse<{ x: number; y: number } | null>>
  getScreenDisplay: () => Promise<IPCResponse<{ x: number; y: number; width: number; height: number } | null>>
  openDevTools: () => Promise<IPCResponse<boolean>>
  openNewWindow: (options?: { filePath?: string; tabData?: DetachedTabData; bounds?: { x: number; y: number; width: number; height: number } }) => Promise<IPCResponse<boolean | number>>
  mergeTab: (tabData: DetachedTabData, targetWindowId: number) => Promise<IPCResponse<boolean>>
  getWindowId: () => Promise<IPCResponse<number | null>>
  listWindows: () => Promise<IPCResponse<Array<{ id: number; title: string; bounds: { x: number; y: number; width: number; height: number } }>>>
  focusWindow: (windowId: number, filePath?: string) => Promise<IPCResponse<boolean>>
  checkFileOpen: (filePath: string) => Promise<IPCResponse<{ windowId: number | null }>>
  updateOpenedFiles: (filePaths: string[]) => Promise<IPCResponse<boolean>>
  setZoom: (zoomLevel: number) => Promise<IPCResponse<void>>
  onDragStart: (callback: (tabId: string) => void) => () => void
  onDragEnd: (callback: () => void) => () => void
  onNewFile: (callback: () => void) => () => void
  onNewWindow: (callback: () => void) => () => void
  onOpenFile: (callback: () => void) => () => void
  onOpenFolder: (callback: () => void) => () => void
  onSave: (callback: () => void) => () => void
  onSaveAs: (callback: () => void) => () => void
  onViewMode: (callback: (mode: string) => void) => () => void
  onCopyAsMarkdown: (callback: () => void) => () => void
  onCopyAsHtml: (callback: () => void) => () => void
  onPasteAsPlain: (callback: () => void) => () => void
  onCaptureScreen: (callback: () => void) => () => void
  onTabMerge: (callback: (tabData: DetachedTabData) => void) => () => void
  onTabDetached: (callback: (tabData: DetachedTabData) => void) => () => void
  onFocusTabForFile: (callback: (filePath: string) => void) => () => void
  onToggleStickyNoteMode: (callback: () => void) => () => void
  onToggleImmersiveMode: (callback: () => void) => () => void
onToggleSidebar: (callback: () => void) => () => void
  onToggleTabBar: (callback: () => void) => () => void
  onToggleStatusBar: (callback: () => void) => () => void
  onToggleTheme: (callback: () => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
  onZoomIn: (callback: () => void) => () => void
  onZoomOut: (callback: () => void) => () => void
  onZoomReset: (callback: () => void) => () => void
  onEditUndo: (callback: () => void) => () => void
  onEditRedo: (callback: () => void) => () => void
  // 格式菜单事件
  onFormatBold: (callback: () => void) => () => void
  onFormatItalic: (callback: () => void) => () => void
  onFormatStrikethrough: (callback: () => void) => () => void
  onFormatCode: (callback: () => void) => () => void
  onFormatLink: (callback: () => void) => () => void
  onFormatImage: (callback: () => void) => () => void
  onFormatHighlight: (callback: () => void) => () => void
  // 段落菜单事件
  onParagraphHeading1: (callback: () => void) => () => void
  onParagraphHeading2: (callback: () => void) => () => void
  onParagraphHeading3: (callback: () => void) => () => void
  onParagraphParagraph: (callback: () => void) => () => void
  onParagraphQuote: (callback: () => void) => () => void
  onParagraphBulletList: (callback: () => void) => () => void
  onParagraphOrderedList: (callback: () => void) => () => void
  onParagraphTaskList: (callback: () => void) => () => void
  onParagraphCodeBlock: (callback: () => void) => () => void
  onParagraphMathBlock: (callback: () => void) => () => void
  onParagraphHorizontalRule: (callback: () => void) => () => void
  // 表格菜单事件
  onTableInsert: (callback: () => void) => () => void
  onTableInsertRowAbove: (callback: () => void) => () => void
  onTableInsertRowBelow: (callback: () => void) => () => void
  onTableInsertColumnLeft: (callback: () => void) => () => void
  onTableInsertColumnRight: (callback: () => void) => () => void
  onTableDeleteRow: (callback: () => void) => () => void
  onTableDeleteColumn: (callback: () => void) => () => void
  // 导航菜单事件
  onNavigationQuickOpen: (callback: () => void) => () => void
  onNavigationGotoLine: (callback: () => void) => () => void
  // 工具菜单事件
  onToolsPreferences: (callback: () => void) => () => void
  onToolsExport: (callback: () => void) => () => void
  // 帮助菜单事件
  onHelpShortcuts: (callback: () => void) => () => void
}

export interface DetachedTabData {
  id: string
  title: string
  content: string
  filePath: string | null
  isDirty: boolean
  viewMode: string
  cursor: { from: number; to: number }
}
