import { defineStore } from 'pinia'
import { ErrorManager, ErrorCode, ErrorSeverity } from '@/services/errorHandler'
import type { AppError } from '@/services/errorHandler'

const manager = new ErrorManager()

export const useErrorStore = defineStore('error', () => {
  function createError(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context?: Record<string, unknown>
  ): AppError {
    return manager.createError(code, message, severity, context)
  }

  function throwError(code: ErrorCode, message: string, context?: Record<string, unknown>): never {
    manager.throwError(code, message, context)
    throw new Error('unreachable')
  }

  function logInfo(message: string, context?: Record<string, unknown>) {
    manager.logInfo(message, context)
  }

  function logWarning(message: string, context?: Record<string, unknown>) {
    manager.logWarning(message, context)
  }

  function logError(message: string, context?: Record<string, unknown>) {
    manager.logError(message, context)
  }

  function logCritical(message: string, context?: Record<string, unknown>) {
    manager.logCritical(message, context)
  }

  async function wrapAsync<T>(
    fn: () => Promise<T>,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context?: Record<string, unknown>
  ): Promise<T | null> {
    return manager.wrapAsync(fn, code, context)
  }

  function wrapSync<T>(
    fn: () => T,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context?: Record<string, unknown>
  ): T | null {
    return manager.wrapSync(fn, code, context)
  }

  function onError(handler: (error: AppError) => void): () => void {
    return manager.onError(handler)
  }

  function getErrors(limit?: number): AppError[] {
    return manager.getErrors(limit)
  }

  function getUnhandledErrors(): AppError[] {
    return manager.getUnhandledErrors()
  }

  function markAsHandled(code: ErrorCode): void {
    manager.markAsHandled(code)
  }

  function clear(): void {
    manager.clear()
  }

  function $reset() {
    manager.clear()
  }

  return {
    createError,
    throwError,
    logInfo,
    logWarning,
    logError,
    logCritical,
    wrapAsync,
    wrapSync,
    onError,
    getErrors,
    getUnhandledErrors,
    markAsHandled,
    clear,
    $reset,
    getErrorMessage: ErrorManager.getErrorMessage,
  }
})

export { ErrorCode, ErrorSeverity }
export type { AppError }
