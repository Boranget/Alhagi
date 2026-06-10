// ============================================================
// Alhagi PreferenceIpcHandlers - 用户偏好持久化 IPC
// ============================================================

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
      (_, prefs: Record<string, unknown>) => {
        this.prefs.setUserPreferences(prefs)
        return true
      },
    )
  }
}
