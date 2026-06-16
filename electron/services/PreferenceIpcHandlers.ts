// ============================================================
// Alhagi PreferenceIpcHandlers - 用户偏好持久化 IPC（Single-Writer）
// ============================================================
//
// 写入侧职责：
//   1. SET_ONE 收到单字段（UI 操作的唯一入口） → 存盘 → 广播 patch 给所有窗口（含发起方）
//   2. SET_ALL 整体覆写（仅供 localStorage→electron-store 迁移用） → 存盘 → 广播给非发起方
//
// 读取侧：
//   3. GET_ALL 整体读出（启动时灌入渲染端 store 默认值）
//
// Single-Writer 不变量：渲染端永远不直接写本地 store，
// UI 控件的 onChange/onInput 必须 invoke SET_ONE，等 CHANGED 广播回来才更新本地 ref。
// 这从架构上消除了"v-model 绕过副作用"、"批量灌入风暴"、"多窗口竞态"全部一类 bug。

import { IPC_CHANNELS, IPCErrorCode } from '../../electron-protocol'
import { registerHandler } from '../ipc-handler'
import type { PreferenceStore } from './PreferenceStore'
import type { PreferenceBroadcaster } from './PreferenceBroadcaster'

export class PreferenceIpcHandlers {
  constructor(
    private prefs: PreferenceStore,
    private broadcaster: PreferenceBroadcaster,
  ) {}

  registerHandlers(): void {
    registerHandler(IPC_CHANNELS.PREFERENCES.GET_ALL, IPCErrorCode.UNKNOWN_ERROR, () => {
      return this.prefs.getUserPreferences()
    })

    // UI 主路径：单字段写入 + 整体性广播 patch（含发起方，发起方也只在收到广播后才更新本地）
    registerHandler(
      IPC_CHANNELS.PREFERENCES.SET_ONE,
      IPCErrorCode.UNKNOWN_ERROR,
      (_event, payload: { key: string; value: unknown }) => {
        this.prefs.setUserPreferenceItem(payload.key, payload.value)
        // includeSender=true：发起方也接收广播，保证渲染端 store 唯一写入入口是
        // applyPatch(广播)；发起方不做乐观更新。这是 single-writer 的核心。
        this.broadcaster.broadcastPatch({ [payload.key]: payload.value })
        return true
      },
    )

    // 迁移路径：整体覆写。不广播给发起方（避免覆盖刚写完的 ref），
    // 也不强求其它窗口收到 —— 迁移期通常只有主窗存在。
    registerHandler(
      IPC_CHANNELS.PREFERENCES.SET_ALL,
      IPCErrorCode.UNKNOWN_ERROR,
      (event, next: Record<string, unknown>) => {
        this.prefs.setUserPreferences(next)
        this.broadcaster.broadcastPatchExcluding(event.sender.id, next)
        return true
      },
    )
  }
}
