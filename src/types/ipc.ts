export enum IPCErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_SAVE_ERROR = 'FILE_SAVE_ERROR',
  FILE_DELETE_ERROR = 'FILE_DELETE_ERROR',
  FILE_RENAME_ERROR = 'FILE_RENAME_ERROR',
  FILE_CREATE_ERROR = 'FILE_CREATE_ERROR',
  DIRECTORY_READ_ERROR = 'DIRECTORY_READ_ERROR',
  DIRECTORY_CREATE_ERROR = 'DIRECTORY_CREATE_ERROR',
  DIALOG_CANCELLED = 'DIALOG_CANCELLED',
  INVALID_PATH = 'INVALID_PATH',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class IPCError extends Error {
  constructor(
    public code: IPCErrorCode,
    message: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'IPCError'
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      name: this.name
    }
  }
}

export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface FileOperationResult {
  success: boolean
  filePath?: string
  content?: string
  error?: {
    code: string
    message: string
  }
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

export function isIPCError(error: unknown): error is IPCError {
  return error instanceof IPCError
}
