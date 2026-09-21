// ============================================================
// Alhagi Layout Store - 窗口运行期 UI 布局
// ============================================================
//
// 这三个开关（侧边栏 / 标签栏 / 状态栏）是窗口的临时 UI 状态：
//   - 不持久化：上次关掉了下次开窗还是 true（写作时关侧栏、回头自动恢复）
//   - per-window：A 窗专注写作只显示编辑区，B 窗保留侧栏作为参考；互不干扰
//   - 新窗口默认 true/true/true
//
// 业务逻辑（IPC 通知）已迁移到 ILayoutSync Gateway，
// 此 store 仅管理纯状态数据。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ILayoutSync } from '@core/domain/ports/gateways/ILayoutSync'
import { LayoutSyncGateway } from '@adapters/gateways/LayoutSyncGateway'

let _layoutSync: ILayoutSync | null = null

function getLayoutSync(): ILayoutSync {
  if (!_layoutSync) _layoutSync = new LayoutSyncGateway()
  return _layoutSync
}

export const useLayoutStore = defineStore('layout', () => {
  const showSidebar = ref(true)
  const showTabBar = ref(true)
  const showStatusBar = ref(true)
  const isStickyNoteMode = ref(false)
  const isImmersiveMode = ref(false)

  function notify(payload: {
    showSidebar?: boolean
    showTabBar?: boolean
    showStatusBar?: boolean
    isStickyNoteMode?: boolean
    isImmersiveMode?: boolean
  }): void {
    getLayoutSync().notifyLayoutChanged(payload).catch(() => {
      /* 静默失败：菜单 checkbox 短暂错位用户可重新点一次 */
    })
  }

  function setSidebar(v: boolean): void {
    if (showSidebar.value === v) return
    showSidebar.value = v
    notify({ showSidebar: v })
  }

  function setTabBar(v: boolean): void {
    if (showTabBar.value === v) return
    showTabBar.value = v
    notify({ showTabBar: v })
  }

  function setStatusBar(v: boolean): void {
    if (showStatusBar.value === v) return
    showStatusBar.value = v
    notify({ showStatusBar: v })
  }

  function toggleSidebar(): void { setSidebar(!showSidebar.value) }
  function toggleTabBar(): void { setTabBar(!showTabBar.value) }
  function toggleStatusBar(): void { setStatusBar(!showStatusBar.value) }

  function setAll(sidebar: boolean, tabBar: boolean, statusBar: boolean): void {
    showSidebar.value = sidebar
    showTabBar.value = tabBar
    showStatusBar.value = statusBar
    notify({ showSidebar: sidebar, showTabBar: tabBar, showStatusBar: statusBar })
  }

  function applyWindowMode(mode: 'normal' | 'sticky' | 'immersive'): void {
    isStickyNoteMode.value = mode === 'sticky'
    isImmersiveMode.value = mode === 'immersive'

    if (mode === 'normal') {
      showSidebar.value = true
      showTabBar.value = true
      showStatusBar.value = true
    } else {
      showSidebar.value = false
      showTabBar.value = false
      showStatusBar.value = false
    }
  }

  function restoreDefaults(): void {
    setAll(true, true, true)
  }

  function setStickyNoteMode(v: boolean): void {
    isStickyNoteMode.value = v
    isImmersiveMode.value = false
    if (v) {
      setAll(false, false, false)
    } else {
      restoreDefaults()
    }
  }

  function setImmersiveMode(v: boolean): void {
    isImmersiveMode.value = v
    isStickyNoteMode.value = false
    if (v) {
      setAll(false, false, false)
    } else {
      restoreDefaults()
    }
  }

  return {
    showSidebar,
    showTabBar,
    showStatusBar,
    isStickyNoteMode,
    isImmersiveMode,
    setSidebar,
    setTabBar,
    setStatusBar,
    toggleSidebar,
    toggleTabBar,
    toggleStatusBar,
    setAll,
    applyWindowMode,
    restoreDefaults,
    setStickyNoteMode,
    setImmersiveMode,
  }
})
