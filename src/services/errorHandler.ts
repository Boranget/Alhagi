/**
 * 统一错误处理系统
 * 提供标准化的错误分类、报告和处理机制
 */

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum ErrorCode {
  // 文件操作错误 (1000-1999)
  FILE_NOT_FOUND = 1001,
  FILE_READ_ERROR = 1002,
  FILE_WRITE_ERROR = 1003,
  FILE_SAVE_ERROR = 1004,
  FILE_DELETE_ERROR = 1005,
  FILE_RENAME_ERROR = 1006,
  
  // 编辑器错误 (2000-2999)
  EDITOR_INIT_ERROR = 2001,
  EDITOR_DESTROY_ERROR = 2002,
  EDITOR_CONTENT_ERROR = 2003,
  EDITOR_SELECTION_ERROR = 2004,
  
  // 标签页错误 (3000-3999)
  TAB_CREATE_ERROR = 3001,
  TAB_CLOSE_ERROR = 3002,
  TAB_SWITCH_ERROR = 3003,
  TAB_SAVE_ERROR = 3004,
  
  // 窗口错误 (4000-4999)
  WINDOW_CREATE_ERROR = 4001,
  WINDOW_CLOSE_ERROR = 4002,
  WINDOW_STATE_ERROR = 4003,
  
  // 自动保存错误 (5000-5999)
  AUTOSAVE_ERROR = 5001,
  AUTOSAVE_TIMEOUT = 5002,
  
  // 系统错误 (9000-9999)
  UNKNOWN_ERROR = 9001,
  VALIDATION_ERROR = 9002,
  PERMISSION_ERROR = 9003
}

export interface AppError {
  code: ErrorCode
  message: string
  severity: ErrorSeverity
  timestamp: number
  context?: Record<string, unknown>
  stack?: string
  handled: boolean
}

type ErrorHandler = (error: AppError) => void

class ErrorManager {
  private errors: AppError[] = []
  private handlers: ErrorHandler[] = []
  private maxErrors = 100
  
  /**
   * 创建应用错误
   */
  createError(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context?: Record<string, unknown>
  ): AppError {
    const error: AppError = {
      code,
      message,
      severity,
      timestamp: Date.now(),
      context,
      stack: new Error().stack,
      handled: false
    }
    
    this.errors.push(error)
    this.trimErrors()
    this.notifyHandlers(error)
    this.reportError(error)
    
    return error
  }
  
  /**
   * 抛出错误（用于需要立即中断的情况）
   */
  throwError(code: ErrorCode, message: string, context?: Record<string, unknown>): never {
    const error = this.createError(
      code,
      message,
      ErrorSeverity.ERROR,
      context
    )
    throw error
  }
  
  /**
   * 记录信息级别的错误
   */
  logInfo(message: string, context?: Record<string, unknown>) {
    this.createError(
      ErrorCode.UNKNOWN_ERROR,
      message,
      ErrorSeverity.INFO,
      context
    )
  }
  
  /**
   * 记录警告级别的错误
   */
  logWarning(message: string, context?: Record<string, unknown>) {
    this.createError(
      ErrorCode.UNKNOWN_ERROR,
      message,
      ErrorSeverity.WARNING,
      context
    )
  }
  
  /**
   * 记录错误但不抛出
   */
  logError(message: string, context?: Record<string, unknown>) {
    this.createError(
      ErrorCode.UNKNOWN_ERROR,
      message,
      ErrorSeverity.ERROR,
      context
    )
  }
  
  /**
   * 记录严重错误
   */
  logCritical(message: string, context?: Record<string, unknown>) {
    this.createError(
      ErrorCode.UNKNOWN_ERROR,
      message,
      ErrorSeverity.CRITICAL,
      context
    )
  }
  
  /**
   * 包装异步函数，自动捕获错误
   */
  async wrapAsync<T>(
    fn: () => Promise<T>,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context?: Record<string, unknown>
  ): Promise<T | null> {
    try {
      return await fn()
    } catch (error) {
      this.createError(
        code,
        error instanceof Error ? error.message : String(error),
        ErrorSeverity.ERROR,
        { ...context, originalError: error }
      )
      return null
    }
  }
  
  /**
   * 包装同步函数，自动捕获错误
   */
  wrapSync<T>(
    fn: () => T,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context?: Record<string, unknown>
  ): T | null {
    try {
      return fn()
    } catch (error) {
      this.createError(
        code,
        error instanceof Error ? error.message : String(error),
        ErrorSeverity.ERROR,
        { ...context, originalError: error }
      )
      return null
    }
  }
  
  /**
   * 注册错误处理器
   */
  onError(handler: ErrorHandler): () => void {
    this.handlers.push(handler)
    return () => {
      const index = this.handlers.indexOf(handler)
      if (index > -1) {
        this.handlers.splice(index, 1)
      }
    }
  }
  
  /**
   * 获取错误历史
   */
  getErrors(limit?: number): AppError[] {
    const errors = [...this.errors].reverse()
    return limit ? errors.slice(0, limit) : errors
  }
  
  /**
   * 获取未处理的错误
   */
  getUnhandledErrors(): AppError[] {
    return this.errors.filter(e => !e.handled)
  }
  
  /**
   * 标记错误为已处理
   */
  markAsHandled(code: ErrorCode): void {
    const error = this.errors.find(e => e.code === code && !e.handled)
    if (error) {
      error.handled = true
    }
  }
  
  /**
   * 清空错误历史
   */
  clear(): void {
    this.errors = []
  }
  
  private trimErrors() {
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors)
    }
  }
  
  private notifyHandlers(error: AppError) {
    this.handlers.forEach(handler => {
      try {
        handler(error)
      } catch (e) {
        // Silent fail - error handler errors
      }
    })
  }
  
  private reportError(error: AppError) {
    if (error.severity === ErrorSeverity.ERROR || 
        error.severity === ErrorSeverity.CRITICAL) {
      // Report to error tracking service
    }
  }
  
  /**
   * 获取错误码对应的友好消息
   */
  static getErrorMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.FILE_NOT_FOUND]: '文件未找到',
      [ErrorCode.FILE_READ_ERROR]: '文件读取失败',
      [ErrorCode.FILE_WRITE_ERROR]: '文件写入失败',
      [ErrorCode.FILE_SAVE_ERROR]: '文件保存失败',
      [ErrorCode.FILE_DELETE_ERROR]: '文件删除失败',
      [ErrorCode.FILE_RENAME_ERROR]: '文件重命名失败',
      [ErrorCode.EDITOR_INIT_ERROR]: '编辑器初始化失败',
      [ErrorCode.EDITOR_DESTROY_ERROR]: '编辑器销毁失败',
      [ErrorCode.EDITOR_CONTENT_ERROR]: '编辑器内容错误',
      [ErrorCode.EDITOR_SELECTION_ERROR]: '编辑器选择错误',
      [ErrorCode.TAB_CREATE_ERROR]: '创建标签页失败',
      [ErrorCode.TAB_CLOSE_ERROR]: '关闭标签页失败',
      [ErrorCode.TAB_SWITCH_ERROR]: '切换标签页失败',
      [ErrorCode.TAB_SAVE_ERROR]: '保存标签页失败',
      [ErrorCode.WINDOW_CREATE_ERROR]: '创建窗口失败',
      [ErrorCode.WINDOW_CLOSE_ERROR]: '关闭窗口失败',
      [ErrorCode.WINDOW_STATE_ERROR]: '窗口状态错误',
      [ErrorCode.AUTOSAVE_ERROR]: '自动保存失败',
      [ErrorCode.AUTOSAVE_TIMEOUT]: '自动保存超时',
      [ErrorCode.UNKNOWN_ERROR]: '未知错误',
      [ErrorCode.VALIDATION_ERROR]: '验证失败',
      [ErrorCode.PERMISSION_ERROR]: '权限错误'
    }
    return messages[code] || '未知错误'
  }
}

export const errorManager = new ErrorManager()

/**
 * 便捷的错误处理装饰器
 */
export function handleError(
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  severity: ErrorSeverity = ErrorSeverity.ERROR
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    
    descriptor.value = function (...args: unknown[]) {
      try {
        return originalMethod.apply(this, args)
      } catch (error) {
        errorManager.createError(
          code,
          error instanceof Error ? error.message : String(error),
          severity,
          { method: propertyKey, args }
        )
        return null
      }
    }
    
    return descriptor
  }
}

/**
 * 异步错误处理装饰器
 */
export function handleAsyncError(
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  severity: ErrorSeverity = ErrorSeverity.ERROR
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: unknown[]) {
      try {
        return await originalMethod.apply(this, args)
      } catch (error) {
        errorManager.createError(
          code,
          error instanceof Error ? error.message : String(error),
          severity,
          { method: propertyKey, args }
        )
        return null
      }
    }
    
    return descriptor
  }
}
