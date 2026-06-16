// ============================================================
// Alhagi SettingsIpcHandlers - 独立设置窗的 IPC
// ============================================================
//
// 仅一个通道：SETTINGS.OPEN —— 主窗（任何窗口）请求打开设置窗。
// 关闭通过设置窗自身的 window.close() 即可，不需要专门的 IPC 通道。
//
// 设置窗用 OPEN_SETTINGS 而不是复用 WINDOW.OPEN_NEW_WINDOW，因为：
//   - 设置窗有专用 entry（settings.html）；
//   - 设置窗是单例（已开则聚焦），与可任意创建的 detached tab 窗口不同；
//   - 设置窗不参与 tab 合并/分离链路。

import { IPC_CHANNELS, IPCErrorCode } from '../../electron-protocol'
import { registerHandler } from '../ipc-handler'
import type { SettingsWindowManager } from './SettingsWindowManager'

export class SettingsIpcHandlers {
  constructor(private settingsWindow: SettingsWindowManager) {}

  registerHandlers(): void {
    registerHandler<boolean>(IPC_CHANNELS.SETTINGS.OPEN, IPCErrorCode.UNKNOWN_ERROR, () => {
      return this.settingsWindow.open()
    })
  }
}
