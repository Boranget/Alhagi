// ============================================================
// Alhagi PreferenceIpcHandlers - 用户偏好持久化 IPC
// ============================================================
//
// 只负责持久化：渲染端 SET_ALL → 整体覆写，GET_ALL → 整体读出。
// 菜单 checkbox 的同步走独立的 LAYOUT.CHANGED 通道（context.ts），
// 不再耦合在偏好变化路径上。

import { IPC_CHANNELS, IPCErrorCode } from '../../electron-protocol'
import { registerHandler } from '../ipc-handler'
import type { PreferenceStore } from './PreferenceStore'

export class PreferenceIpcHandlers {
  constructor(private prefs: PreferenceStore) {}

  registerHandlers(): void {
    registerHandler(IPC_CHANNELS.PREFERENCES.GET_ALL, IPCErrorCode.UNKNOWN_ERROR, () => {
      return this.prefs.getUserPreferences()
    })

    registerHandler(
      IPC_CHANNELS.PREFERENCES.SET_ALL,
      IPCErrorCode.UNKNOWN_ERROR,
      (_, next: Record<string, unknown>) => {
        this.prefs.setUserPreferences(next)
        return true
      },
    )
  }
}
