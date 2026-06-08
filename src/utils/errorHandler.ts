export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical'

export interface ErrorContext {
  module: string
  function?: string
  line?: number
  additionalData?: Record<string, unknown>
}

export class ErrorHandler {
  private static instance: ErrorHandler | null = null
  private enabled = true

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  handle(error: unknown, context: ErrorContext): void {
    if (!this.enabled) return

    const severity = this.determineSeverity(error)
    const errorInfo = this.extractErrorInfo(error)

    console.error(
      `[${severity.toUpperCase()}] [${context.module}]${context.function ? ` ${context.function}` : ''}: ${errorInfo.message}`,
      {
        stack: errorInfo.stack,
        line: context.line,
        ...context.additionalData
      }
    )

    if (severity === 'critical') {
      this.showUserNotification(errorInfo.message, context.module)
    }
  }

  async handleAsync<T>(
    fn: () => Promise<T>,
    context: ErrorContext,
    fallback: T
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      this.handle(error, context)
      return fallback
    }
  }

  log(message: string, context: ErrorContext, severity: ErrorSeverity = 'info'): void {
    if (!this.enabled) return

    console.log(
      `[${severity.toUpperCase()}] [${context.module}]${context.function ? ` ${context.function}` : ''}: ${message}`
    )
  }

  private determineSeverity(error: unknown): ErrorSeverity {
    if (error instanceof Error) {
      if (error.name === 'CriticalError') return 'critical'
      if (error.name === 'RangeError' || error.name === 'TypeError') return 'error'
    }
    return 'error'
  }

  private extractErrorInfo(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        message: error.message || 'Unknown error',
        stack: error.stack
      }
    }
    return {
      message: String(error) || 'Unknown error'
    }
  }

  private showUserNotification(message: string, module: string): void {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.showErrorNotification(message, module)
    }
  }
}

export function useErrorHandler(): ErrorHandler {
  return ErrorHandler.getInstance()
}

export function handleError(error: unknown, module: string, functionName?: string): void {
  const handler = ErrorHandler.getInstance()
  handler.handle(error, { module, function: functionName })
}

export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  module: string,
  functionName?: string,
  fallback?: T
): Promise<T | undefined> {
  const handler = ErrorHandler.getInstance()
  return handler.handleAsync(fn, { module, function: functionName }, fallback as T)
}