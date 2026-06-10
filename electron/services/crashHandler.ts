// ============================================================
// Alhagi 主进程崩溃处理（P2-11）
// ============================================================
//
// 三层防护：
//   1. uncaughtException / unhandledRejection：主进程未捕获异常
//      → 弹原生 dialog，Copy Error / Reload / Close 三选一
//   2. BrowserWindow 的 'render-process-gone'：渲染进程崩溃（Chrome OOM、
//      未捕获 throw 等）→ 弹 Reload / Close 对话框
//   3. BrowserWindow 的 'unresponsive' / 'responsive'：仅日志记录，
//      不打扰用户（系统繁忙时假阳性多）

import { app, dialog, clipboard, BrowserWindow, type BrowserWindow as BrowserWindowType } from 'electron'

let isShowingDialog = false

/**
 * 安装主进程顶层异常 handler。在 app.whenReady() 之前调用，
 * 否则启动阶段的异常无法捕获。
 */
export function installMainProcessCrashHandlers(): void {
  process.on('uncaughtException', (error) => {
    console.error('[crash] uncaughtException:', error)
    showFatalDialog('Uncaught Exception', error)
  })

  process.on('unhandledRejection', (reason) => {
    console.error('[crash] unhandledRejection:', reason)
    const err = reason instanceof Error ? reason : new Error(String(reason))
    showFatalDialog('Unhandled Promise Rejection', err)
  })
}

/**
 * 为每个新窗口绑定渲染进程崩溃监听。
 */
export function attachRendererCrashHandler(win: BrowserWindowType): void {
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[crash] render-process-gone:', details)
    if (isShowingDialog) return
    isShowingDialog = true

    const reasonText = `reason: ${details.reason}\nexitCode: ${details.exitCode}`

    dialog
      .showMessageBox(win, {
        type: 'error',
        title: '渲染进程已停止',
        message: '窗口的渲染进程意外结束，是否重新加载？',
        detail: reasonText,
        buttons: ['重新加载', '关闭窗口', '保持现状'],
        defaultId: 0,
        cancelId: 2,
      })
      .then((result) => {
        isShowingDialog = false
        if (win.isDestroyed()) return
        if (result.response === 0) {
          win.webContents.reload()
        } else if (result.response === 1) {
          win.close()
        }
      })
      .catch((err) => {
        isShowingDialog = false
        console.error('[crash] dialog failed:', err)
      })
  })

  // 仅日志，不弹框：系统繁忙时常见假阳性
  win.on('unresponsive', () => {
    console.warn(`[crash] window ${win.id} unresponsive`)
  })
  win.on('responsive', () => {
    console.warn(`[crash] window ${win.id} responsive again`)
  })
}

function showFatalDialog(title: string, error: Error): void {
  if (isShowingDialog) return
  isShowingDialog = true

  const detail = `${error.message}\n\n${error.stack ?? '(no stack)'}`

  // app 未 ready 时 dialog 不可用，只能打印
  if (!app.isReady()) {
    console.error(`[crash] ${title} before app ready:\n${detail}`)
    return
  }

  dialog
    .showMessageBox({
      type: 'error',
      title: `主进程异常 - ${title}`,
      message: error.message || '发生未捕获的异常',
      detail,
      buttons: ['复制错误信息', '重新加载', '退出', '忽略'],
      defaultId: 1,
      cancelId: 3,
    })
    .then((result) => {
      isShowingDialog = false
      if (result.response === 0) {
        clipboard.writeText(`[${title}] ${detail}`)
      } else if (result.response === 1) {
        // 重新加载所有窗口
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.reload()
        }
      } else if (result.response === 2) {
        app.exit(1)
      }
    })
    .catch((err) => {
      isShowingDialog = false
      console.error('[crash] showFatalDialog failed:', err)
    })
}
