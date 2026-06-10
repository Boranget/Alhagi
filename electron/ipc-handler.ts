// ============================================================
// Alhagi 主进程 IPC 通用模板
// ============================================================
//
// 主进程几乎所有 IPC handler 的模板都是：
//   try { ...逻辑... return createSuccessResponse(data) }
//   catch (err) { 判断 ENOENT/EACCES，返回 createErrorResponse(...) }
//
// 重复这套模板 25+ 次让 main.ts 臃肿到 750 行。本模块抽取 wrapHandler()，
// 各服务只写"业务逻辑 + 抛错"，错误响应统一由这里生成。

import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import {
  createSuccessResponse,
  createErrorResponse,
  IPCErrorCode,
  type IPCResponse,
} from '../electron-protocol'

function isFileNotFoundError(error: NodeJS.ErrnoException): boolean {
  return error.code === 'ENOENT'
}

function isPermissionError(error: NodeJS.ErrnoException): boolean {
  return error.code === 'EACCES' || error.code === 'EPERM'
}

/**
 * 自动把 NodeJS.ErrnoException 映射到合适的 IPCErrorCode。
 * 业务 handler 只需 throw（或返回普通值），剩下的统一在这里处理。
 *
 * @param defaultCode 业务的默认错误码（例如 FILE_SAVE_ERROR / DIRECTORY_READ_ERROR）
 */
export function toIPCError(err: unknown, defaultCode: IPCErrorCode): IPCResponse<never> {
  const error = err as NodeJS.ErrnoException
  const message = error?.message || String(err)
  if (isFileNotFoundError(error)) {
    return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${message}`)
  }
  if (isPermissionError(error)) {
    return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${message}`)
  }
  return createErrorResponse(defaultCode, message)
}

/**
 * 注册一个 IPC handler。
 *
 * 业务函数返回值会被自动包装为成功响应；抛出的异常会被映射为失败响应。
 * 如果业务函数已经返回 `IPCResponse`（例如手动处理特殊错误），原样透传。
 */
export function registerHandler<T>(
  channel: string,
  defaultErrorCode: IPCErrorCode,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = await handler(event, ...args)
      // 业务函数可能已经返回完整响应壳（例如对话框取消时返回 success/null）
      if (result && typeof result === 'object' && 'success' in result) {
        return result
      }
      return createSuccessResponse(result)
    } catch (err) {
      return toIPCError(err, defaultErrorCode)
    }
  })
}

/**
 * 同步注册简单的同步 handler（不需要 async/await）
 */
export function registerSyncHandler<T>(
  channel: string,
  defaultErrorCode: IPCErrorCode,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => T
): void {
  ipcMain.handle(channel, (event, ...args) => {
    try {
      const result = handler(event, ...args)
      if (result && typeof result === 'object' && 'success' in result) {
        return result
      }
      return createSuccessResponse(result)
    } catch (err) {
      return toIPCError(err, defaultErrorCode)
    }
  })
}
