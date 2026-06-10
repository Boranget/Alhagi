// ============================================================
// Alhagi DialogService - 对话框相关 IPC
// ============================================================

import { dialog } from 'electron'
import {
  IPC_CHANNELS,
  IPCErrorCode,
  createSuccessResponse,
  createErrorResponse,
} from '../../electron-protocol'
import { registerHandler } from '../ipc-handler'
import type { WindowManager } from './WindowManager'

export class DialogService {
  constructor(private windowManager: WindowManager) {}

  registerHandlers(): void {
    registerHandler(IPC_CHANNELS.DIALOG.SELECT_DIRECTORY, IPCErrorCode.UNKNOWN_ERROR, async () => {
      const win = this.windowManager.getMainWindow()
      if (!win) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')
      const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      if (result.canceled || result.filePaths.length === 0) return createSuccessResponse(null)
      return createSuccessResponse(result.filePaths[0])
    })
  }
}
