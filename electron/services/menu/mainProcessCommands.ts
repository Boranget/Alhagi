// ============================================================
// Alhagi MenuBuilder - 主进程本地命令 handler
// ============================================================
//
// 「只能在主进程做」的命令：操作 BrowserWindow、dialog 等 Electron 主进程 API。
// 这些命令的 click handler 直接在主进程跑，不通过 COMMAND.EXECUTE 转给渲染端。
//
// 渲染端如果通过命令面板触发这些 ID，会走 dispatcher → 失败（因为没注册 handler）。
// 后续可让 dispatcher 检测此类「主进程命令」并通过 IPC 回到主进程；本期 P2-12 不展开。

import { dialog } from 'electron'
import { MENU_EVENTS } from '../../../electron-protocol/menu-events'
import type { WindowManager } from '../WindowManager'

export interface MainCommandContext {
  windowManager: WindowManager
}

export type MainCommandHandler = (ctx: MainCommandContext) => void

export const MAIN_PROCESS_COMMANDS: Record<string, MainCommandHandler> = {
  'view.fullscreen': ({ windowManager }) => {
    const win = windowManager.getMainWindow()
    if (win) win.setFullScreen(!win.isFullScreen())
  },

  'view.devTools': ({ windowManager }) => {
    const win = windowManager.getMainWindow()
    if (!win) return
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools()
    } else {
      win.webContents.openDevTools()
    }
  },

  'view.stickyNoteMode': ({ windowManager }) => {
    const win = windowManager.getMainWindow()
    if (!win) return
    const [w, h] = win.getSize()
    const isSmall = w <= 400 && h <= 500
    if (isSmall) {
      win.setSize(1200, 800)
      win.setAlwaysOnTop(false)
    } else {
      win.setSize(350, 450)
      win.setAlwaysOnTop(true)
    }
    // 通知渲染端同步 UI 状态（保留老 MENU_EVENTS 通道兼容现有 onToggleStickyNoteMode 订阅）
    win.webContents.send(MENU_EVENTS.TOGGLE_STICKY_NOTE)
  },

  'help.about': () => {
    dialog.showMessageBox({
      type: 'info',
      title: '关于 顾念笔记',
      message: '顾念笔记 (Alhagi) v1.0.0',
      detail: '基于 Milkdown 的现代化 Markdown 编辑器',
    })
  },
}
