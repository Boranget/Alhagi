// ============================================================
// Alhagi MenuBuilder - 主进程本地命令 handler
// ============================================================
//
// 「只能在主进程做」的命令：操作 BrowserWindow、dialog 等 Electron 主进程 API。
//
// 两种调用入口：
//   1. 菜单 click：menuTemplateBuilder 命中此表则直接在主进程跑，不通过 COMMAND.EXECUTE
//   2. 渲染端 dispatcher handler：通过 IPC_CHANNELS.COMMAND.EXECUTE_MAIN 让主进程跑
//      （命令面板 / 快捷键路径），与菜单 click 收敛到同一份实现
//
// 命名约定：纯主进程副作用的命令 ID 与 registry 中用户层命令相同
// （如 view.fullscreen、view.devTools）。需要主进程 + 渲染端各做一半副作用的命令
// （如 view.stickyNoteMode），主进程一侧用 `.<suffix>` 后缀（如 view.stickyNoteMode.window），
// 避免菜单 click 命中 main handler 后跳过渲染端 dispatcher。

import { dialog } from 'electron'
import type { WindowManager } from '../WindowManager'

export interface MainCommandContext {
  windowManager: WindowManager
}

export type MainCommandHandler = (ctx: MainCommandContext) => void

export const MAIN_PROCESS_COMMANDS: Record<string, MainCommandHandler> = {
  'file.newWindow': ({ windowManager }) => {
    windowManager.createNewWindow()
  },

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

  // 注意命名带 `.window` 后缀：与 registry 中用户层 `view.stickyNoteMode` 错开，
  // 菜单 click view.stickyNoteMode 走默认 COMMAND.EXECUTE → 渲染端 dispatcher，
  // dispatcher 再调 executeMainCommand('view.stickyNoteMode.window') 触发这里。
  'view.stickyNoteMode.window': ({ windowManager }) => {
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
