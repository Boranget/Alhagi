// ============================================================
// Alhagi MenuBuilder - 应用菜单构建（per-window 版）
// ============================================================
//
// 每个 BrowserWindow 持有它专属的 Electron Menu 实例（windowMenus Map）。
// 这样：
//   - 多窗口 layout 互不干扰：A 窗关侧栏不影响 B 窗
//   - 状态变化走 in-place 改 MenuItem.checked，不重建整菜单
//   - macOS 的应用级单一菜单则跟随焦点窗口动态切换（onWindowFocus）
//
// 实际模板生成委托 menu/menuTemplateBuilder.ts；本类负责生命周期 +
// per-window 调度。

import { Menu } from 'electron'
import type { BrowserWindow } from 'electron'
import type { WindowManager } from './WindowManager'
import { buildMenuTemplate } from './menu/menuTemplateBuilder'
import { detectPlatform } from './menu/platform'
import type { Language } from '../../electron-protocol/i18n/dictionaries'

/** 渲染端 layout store 的 key → 菜单项 id（即 cmd.id）的映射 */
const LAYOUT_COMMAND_IDS = ['view.toggleSidebar', 'view.toggleTabBar', 'view.toggleStatusBar'] as const

export class MenuBuilder {
  private currentLanguage: Language = 'zh-CN'
  private windowMenus = new Map<number, Menu>()

  constructor(private windowManager: WindowManager) {}

  /**
   * 启动期调用：仅锁定当前语言。真正的菜单创建由
   * WindowManager 在每个新窗口注册时调 installForWindow 触发。
   */
  install(language?: Language): void {
    if (language) this.currentLanguage = language
  }

  /**
   * 给指定窗口构建并挂上专属菜单。
   *
   * 平台差异：
   *   - macOS：应用菜单是进程级单一菜单，仅当 win 是当前焦点窗口时
   *     setApplicationMenu；非焦点窗口的菜单等到 onWindowFocus 时再切。
   *   - Windows / Linux：菜单挂在窗口标题栏上，每窗各自独立，立即 setMenu。
   */
  installForWindow(win: BrowserWindow): void {
    const template = buildMenuTemplate({
      language: this.currentLanguage,
      platform: detectPlatform(),
      windowManager: this.windowManager,
    })
    const menu = Menu.buildFromTemplate(template)
    this.windowMenus.set(win.id, menu)

    if (process.platform === 'darwin') {
      if (win.isFocused()) Menu.setApplicationMenu(menu)
    } else {
      win.setMenu(menu)
    }
  }

  /** 窗口关闭时清理引用，避免 windowId 复用时的脏数据 */
  removeWindow(windowId: number): void {
    this.windowMenus.delete(windowId)
  }

  /**
   * 渲染端 layout 变化 → in-place 改某窗口某 checkbox 的 checked 状态。
   * 不重建菜单（性能 / 不丢菜单焦点状态）。
   *
   * commandId 与 registry 中的 cmd.id 一致（菜单项构建时已 id: cmd.id）。
   */
  setLayoutItem(windowId: number, commandId: string, checked: boolean): void {
    const menu = this.windowMenus.get(windowId)
    const item = menu?.getMenuItemById(commandId)
    if (item) item.checked = checked
  }

  /**
   * macOS 焦点窗口切换：把目标窗口的菜单设为 application menu。
   * Win/Linux 上每窗各自挂菜单，无需此操作（直接 no-op）。
   */
  onWindowFocus(win: BrowserWindow): void {
    if (process.platform !== 'darwin') return
    const menu = this.windowMenus.get(win.id)
    if (menu) Menu.setApplicationMenu(menu)
  }

  /**
   * 用当前（或新）语言重建所有窗口菜单。
   *
   * 关键：保留 layout checkbox 状态。语言切换会扔掉旧菜单实例，
   * 新菜单按 buildItem 默认 checked=true 生成；如果用户当前在 sticky 模式
   * 三块都隐藏，rebuild 后 checkbox 错位。这里做 snapshot+回写来对齐。
   */
  rebuild(language?: Language): void {
    if (language) this.currentLanguage = language

    for (const win of this.windowManager.getAllWindows().values()) {
      if (win.isDestroyed()) continue

      // 快照：旧菜单中三个 layout checkbox 的状态
      const oldMenu = this.windowMenus.get(win.id)
      const snapshot: Record<string, boolean> = {}
      if (oldMenu) {
        for (const id of LAYOUT_COMMAND_IDS) {
          const item = oldMenu.getMenuItemById(id)
          if (item) snapshot[id] = item.checked
        }
      }

      // 重建（覆盖 windowMenus.get(win.id)）
      this.installForWindow(win)

      // 回写
      const newMenu = this.windowMenus.get(win.id)
      for (const [id, checked] of Object.entries(snapshot)) {
        const item = newMenu?.getMenuItemById(id)
        if (item) item.checked = checked
      }
    }
  }

  getCurrentLanguage(): Language {
    return this.currentLanguage
  }
}
