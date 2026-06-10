// ============================================================
// Alhagi 主进程入口
// ============================================================
//
// 这个文件只负责：
//  1. 计算路径环境变量
//  2. 在 app.whenReady() 之后构造 AppContext 并启动
//  3. 处理 Electron 生命周期事件（window-all-closed / activate）
//
// 业务逻辑全部委托给 electron/services/ 下的服务类。

import { app } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppContext } from './context'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let context: AppContext | null = null

app.whenReady().then(() => {
  context = new AppContext(VITE_DEV_SERVER_URL, RENDERER_DIST)
  context.start()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (context && !context.windowManager.getMainWindow()) {
    context.windowManager.createMainWindow()
  }
})
