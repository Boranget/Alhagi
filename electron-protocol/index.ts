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
    READ: 'file:read',
    OPEN_FOLDER: 'file:open-folder',
    READ_DIRECTORY: 'file:read-directory',
    CREATE: 'file:create',
    DELETE: 'file:delete',
    RENAME: 'file:rename',
    MOVE: 'file:move',
    COPY: 'file:copy',
    SEARCH_IN_DIRECTORY: 'file:search-in-directory'
  },
  DIALOG: {
    SELECT_DIRECTORY: 'dialog:select-directory'
  },
  WINDOW: {
    MINIMIZE: 'window:minimize',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close',
    SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
    OPEN_NEW_WINDOW: 'window:open-new-window'
  }
} as const;

// ========== 菜单事件常量 ==========
export const MENU_EVENTS = {
  NEW_FILE: 'menu:new-file',
  OPEN_FILE: 'menu:open-file',
  OPEN_FOLDER: 'menu:open-folder',
  SAVE: 'menu:save',
  SAVE_AS: 'menu:save-as',
  VIEW_MODE: 'menu:view-mode',
  COPY_AS_MARKDOWN: 'menu:copy-as-markdown',
  COPY_AS_HTML: 'menu:copy-as-html',
  PASTE_AS_PLAIN: 'menu:paste-as-plain',
  CAPTURE_SCREEN: 'menu:capture-screen'
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
  readFile: (filePath: string) => Promise<IPCResponse<string>>
  openFolder: () => Promise<IPCResponse<{ path: string; tree: FileTreeNode[] } | null>>
  readDirectory: (dirPath: string) => Promise<IPCResponse<DirectoryEntry[]>>
  createFile: (dirPath: string, fileName: string) => Promise<IPCResponse<string | null>>
  createDirectory: (dirPath: string, dirName: string) => Promise<IPCResponse<string | null>>
  deleteFile: (filePath: string) => Promise<IPCResponse<boolean>>
  renameFile: (oldPath: string, newName: string) => Promise<IPCResponse<string | null>>
  moveFile: (sourcePath: string, targetDir: string) => Promise<IPCResponse<string | null>>
  copyFile: (sourcePath: string, targetDir: string) => Promise<IPCResponse<string | null>>
  selectDirectory: () => Promise<IPCResponse<string | null>>
  searchInDirectory: (dirPath: string, query: string, options?: SearchOptions) => Promise<IPCResponse<SearchResult[]>>
  minimize: () => Promise<IPCResponse<void>>
  maximize: () => Promise<IPCResponse<void>>
  close: () => Promise<IPCResponse<void>>
  setAlwaysOnTop: (flag: boolean) => Promise<IPCResponse<void>>
  openNewWindow: (options?: { filePath?: string; tabData?: DetachedTabData }) => Promise<IPCResponse<boolean>>
  onNewFile: (callback: () => void) => () => void
  onOpenFile: (callback: () => void) => () => void
  onSave: (callback: () => void) => () => void
  onSaveAs: (callback: () => void) => () => void
  onViewMode: (callback: (mode: string) => void) => () => void
  onCopyAsMarkdown: (callback: () => void) => () => void
  onCopyAsHtml: (callback: () => void) => () => void
  onPasteAsPlain: (callback: () => void) => () => void
  onCaptureScreen: (callback: () => void) => () => void
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
