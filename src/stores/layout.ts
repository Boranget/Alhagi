// ============================================================
// Alhagi Layout Store - 窗口运行期 UI 布局
// ============================================================
//
// 这三个开关（侧边栏 / 标签栏 / 状态栏）是窗口的临时 UI 状态：
//   - 不持久化：上次关掉了下次开窗还是 true（写作时关侧栏、回头自动恢复）
//   - per-window：A 窗专注写作只显示编辑区，B 窗保留侧栏作为参考；互不干扰
//   - 新窗口默认 true/true/true
//
// 对比 preferences store：偏好走 IPC 全量同步 + electron-store；
// 这里走独立 LAYOUT.CHANGED 通道，让主进程 in-place 改对应窗口菜单
// 的 MenuItem.checked，不重建菜单（参考 MarkText viewLayoutChanged 模式）。
//
// sticky / immersive 模式下 prefs store 调 setAll/restoreDefaults 批量切，
// 一次 IPC 把三键都带上，避免连发三条。

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLayoutStore = defineStore('layout', () => {
  const showSidebar = ref(true)
  const showTabBar = ref(true)
  const showStatusBar = ref(true)

  /** 通知主进程 in-place 更新当前窗口菜单的 checkbox。失败静默——菜单项错位远比 IPC 异常容忍 */
  function notify(payload: { showSidebar?: boolean; showTabBar?: boolean; showStatusBar?: boolean }): void {
    window.electronAPI?.layoutChanged(payload).catch(() => {
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

  /**
   * 批量设三键（sticky/immersive 模式进/出场景）。
   * 合并成单条 IPC 通知主进程，避免单 setter 连发三条。
   */
  function setAll(sidebar: boolean, tabBar: boolean, statusBar: boolean): void {
    showSidebar.value = sidebar
    showTabBar.value = tabBar
    showStatusBar.value = statusBar
    notify({ showSidebar: sidebar, showTabBar: tabBar, showStatusBar: statusBar })
  }

  /** 恢复到新窗口的默认布局（全显示） */
  function restoreDefaults(): void {
    setAll(true, true, true)
  }

  return {
    showSidebar,
    showTabBar,
    showStatusBar,
    setSidebar,
    setTabBar,
    setStatusBar,
    toggleSidebar,
    toggleTabBar,
    toggleStatusBar,
    setAll,
    restoreDefaults,
  }
})
