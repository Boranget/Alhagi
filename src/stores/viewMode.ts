// ============================================================
// Alhagi ViewMode Store - 写作辅助视图模式（per-window 不持久化）
// ============================================================
//
// 打字机模式 / 专注模式属于"当前写作时的临时视图状态"：
//   - 不持久化：用户开了专注模式写完一段就切走，下次开窗回到默认
//   - per-window：A 窗专注写作 / B 窗参考浏览，各自独立
//
// 与 preferencesStore 解耦：偏好系统是"持久化 + 跨窗口同步"，这两个开关
// 不需要任何一个特性，硬塞进 preferences 反而带来不必要的 IPC + 持久化。
//
// 与 layoutStore 同款：临时窗口状态 + 简单 setter + 通知主进程同步菜单 checkbox。
// IPC 通知已迁移到 ILayoutSync Gateway。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ILayoutSync } from '@core/domain/ports/gateways/ILayoutSync'
import { LayoutSyncGateway } from '@adapters/gateways/LayoutSyncGateway'

let _layoutSync: ILayoutSync | null = null

function getLayoutSync(): ILayoutSync {
  if (!_layoutSync) _layoutSync = new LayoutSyncGateway()
  return _layoutSync
}

export const useViewModeStore = defineStore('viewMode', () => {
  const typewriterMode = ref(false)
  const focusMode = ref(false)

  function notify(payload: { typewriterMode?: boolean; focusMode?: boolean }): void {
    getLayoutSync().notifyLayoutChanged(payload).catch(() => {
      /* 静默失败 */
    })
  }

  function setTypewriterMode(v: boolean): void {
    if (typewriterMode.value === v) return
    typewriterMode.value = v
    notify({ typewriterMode: v })
  }

  function setFocusMode(v: boolean): void {
    if (focusMode.value === v) return
    focusMode.value = v
    notify({ focusMode: v })
  }

  return {
    typewriterMode,
    focusMode,
    setTypewriterMode,
    setFocusMode,
  }
})
