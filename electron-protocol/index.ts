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
