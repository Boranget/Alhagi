// ============================================================
// Alhagi ClipboardService - 系统剪贴板原生访问
// ============================================================
//
// 截图粘贴优化：Electron clipboard.readImage() 在主进程线程读 NativeImage，
// 比渲染端 FileReader.readAsDataURL 同步阻塞快得多，且不占用 V8 主线程时间。

import { clipboard } from 'electron'
import {
  IPCErrorCode,
  IPC_CHANNELS,
  createSuccessResponse,
} from '../../electron-protocol'
import { registerHandler } from '../ipc-handler'

export class ClipboardService {
  registerHandlers(): void {
    registerHandler(IPC_CHANNELS.CLIPBOARD.READ_IMAGE, IPCErrorCode.UNKNOWN_ERROR, () => {
      const image = clipboard.readImage()
      if (image.isEmpty()) return createSuccessResponse(null)

      const { width, height } = image.getSize()
      const buffer = image.toPNG()
      const base64 = buffer.toString('base64')
      return createSuccessResponse({ base64, width, height })
    })
  }
}
