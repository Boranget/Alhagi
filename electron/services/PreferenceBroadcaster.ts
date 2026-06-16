// ============================================================
// Alhagi PreferenceBroadcaster - 偏好变更跨窗口广播
// ============================================================
//
// Single-Writer 模式下，主进程是唯一写入者。每次 setUserPreferenceItem
// 完成后调用 broadcastPatch() 把 **patch（增量）** 推给所有窗口（含发起方）：
// 各窗口的渲染端 store 收到后才用 patch 更新本地 ref —— 这是渲染端唯一
// 写入路径。
//
// 不再需要 isApplyingBroadcast 这种 guard：渲染端不会反向写盘，闭环天然无环。
//
// 为什么 SET_ONE 要 includeSender 而 SET_ALL 不要：
//   - SET_ONE：发起方也走广播路径才能保证 single-writer 不变量；它的 UI 控件
//     是 :value 单向绑定，本地 ref 必须等广播回来才变。
//   - SET_ALL：仅迁移用；迁移时发起方已经持有完整 prefs 在 ref 里（它就是发起者），
//     回灌一遍既无意义又会触发一轮 watcher，干脆排除。

import { IPC_CHANNELS } from '../../electron-protocol'
import type { WindowManager } from './WindowManager'
import type { SettingsWindowManager } from './SettingsWindowManager'

export class PreferenceBroadcaster {
  constructor(
    private windowManager: WindowManager,
    private settingsWindow: SettingsWindowManager,
  ) {}

  /**
   * 给所有窗口（含发起方）广播 patch。
   * SET_ONE 用此方法 —— single-writer 不变量要求发起方也走广播路径更新本地。
   */
  broadcastPatch(patch: Record<string, unknown>): void {
    this.send(patch, /* excludeId */ null)
  }

  /**
   * 给除发起方外的所有窗口广播 patch。
   * SET_ALL（迁移）用此方法 —— 发起方已持有完整数据，无需回灌。
   */
  broadcastPatchExcluding(senderWebContentsId: number, patch: Record<string, unknown>): void {
    this.send(patch, senderWebContentsId)
  }

  private send(patch: Record<string, unknown>, excludeId: number | null): void {
    for (const win of this.windowManager.getAllWindows().values()) {
      if (win.isDestroyed()) continue
      if (excludeId !== null && win.webContents.id === excludeId) continue
      win.webContents.send(IPC_CHANNELS.PREFERENCES.CHANGED, patch)
    }

    const settingsWin = this.settingsWindow.getWindow()
    if (
      settingsWin &&
      !settingsWin.isDestroyed() &&
      (excludeId === null || settingsWin.webContents.id !== excludeId)
    ) {
      settingsWin.webContents.send(IPC_CHANNELS.PREFERENCES.CHANGED, patch)
    }
  }
}
