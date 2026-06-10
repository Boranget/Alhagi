// ============================================================
// Alhagi WindowManager - 窗口生命周期、打开文件追踪、新窗口创建
// ============================================================
//
// 持有所有 BrowserWindow，提供：
// - createMainWindow() / createNewWindow()
// - 窗口列表查询 / 跨窗口"该文件是否已打开"
// - 主进程发出去的 tab 跨窗口转发（merge/detach/focus-for-file）

import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC_CHANNELS, type DetachedTabData } from '../../electron-protocol'
import type { PreferenceStore } from './PreferenceStore'
import type { ThemeService } from './ThemeService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface NewWindowOptions {
  bounds?: { x: number; y: number; width: number; height: number }
  filePath?: string
  tabData?: DetachedTabData
}

export class WindowManager {
  private windows = new Map<number, BrowserWindow>()
  private windowOpenFiles = new Map<number, string[]>()
  private mainWindow: BrowserWindow | null = null

  constructor(
    private prefs: PreferenceStore,
    private theme: ThemeService,
    private viteDevServerUrl: string | undefined,
    private rendererDist: string,
  ) {}

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  getAllWindows(): Map<number, BrowserWindow> {
    return this.windows
  }

  getWindow(id: number): BrowserWindow | undefined {
    return this.windows.get(id)
  }

  getOpenFilesMap(): Map<number, string[]> {
    return this.windowOpenFiles
  }

  updateOpenedFiles(windowId: number, filePaths: string[]): void {
    this.windowOpenFiles.set(windowId, filePaths)
  }

  /**
   * 查找已打开 filePath 的窗口（排除指定窗口）。返回 null 表示无匹配。
   */
  findWindowWithFile(filePath: string, excludeWindowId?: number): number | null {
    for (const [windowId, openFiles] of this.windowOpenFiles) {
      if (windowId === excludeWindowId) continue
      if (openFiles.includes(filePath)) return windowId
    }
    return null
  }

  /**
   * 列出全部活动窗口的元信息（自动清理已销毁的窗口引用）。
   */
  listWindows(): Array<{
    id: number
    title: string
    bounds: { x: number; y: number; width: number; height: number }
  }> {
    const result: Array<{
      id: number
      title: string
      bounds: { x: number; y: number; width: number; height: number }
    }> = []
    for (const [id, win] of this.windows) {
      if (!win || win.isDestroyed()) {
        this.windows.delete(id)
        continue
      }
      try {
        const bounds = win.getBounds()
        result.push({ id, title: win.getTitle(), bounds })
      } catch {
        this.windows.delete(id)
      }
    }
    return result
  }

  createMainWindow(): BrowserWindow {
    const windowState = this.prefs.getWindowState()
    const backgroundColor = this.theme.getBackgroundColor()

    const win = new BrowserWindow({
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      minWidth: 250,
      minHeight: 300,
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
      },
      show: false,
      backgroundColor,
    })

    this.registerWindow(win)
    this.mainWindow = win

    win.on('ready-to-show', () => {
      if (windowState.isMaximized) win.maximize()
      win.show()
    })

    win.on('close', () => {
      if (!win.isDestroyed()) {
        const bounds = win.getBounds()
        this.prefs.setWindowState({
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized: win.isMaximized(),
        })
      }
    })

    win.on('closed', () => {
      this.windows.delete(win.id)
      this.windowOpenFiles.delete(win.id)
      if (this.mainWindow === win) {
        this.mainWindow = null
      }
    })

    if (this.viteDevServerUrl) {
      win.loadURL(this.viteDevServerUrl)
    } else {
      win.loadFile(path.join(this.rendererDist, 'index.html'))
    }

    return win
  }

  createNewWindow(options?: NewWindowOptions): BrowserWindow {
    const bounds = options?.bounds || { x: 0, y: 0, width: 1200, height: 800 }
    const backgroundColor = this.theme.getBackgroundColor()

    const win = new BrowserWindow({
      width: bounds.width || 1200,
      height: bounds.height || 800,
      x: bounds.x,
      y: bounds.y,
      minWidth: 250,
      minHeight: 300,
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
      backgroundColor,
    })

    this.registerWindow(win)

    win.on('closed', () => {
      this.windows.delete(win.id)
      this.windowOpenFiles.delete(win.id)
    })

    win.on('ready-to-show', () => win.show())

    const filePath = options?.filePath
    const url = this.viteDevServerUrl
    if (url) {
      win.loadURL(filePath ? `${url}?file=${encodeURIComponent(filePath)}` : url)
    } else {
      const file = filePath
        ? `${path.join(this.rendererDist, 'index.html')}?file=${encodeURIComponent(filePath)}`
        : path.join(this.rendererDist, 'index.html')
      win.loadFile(file)
    }

    if (options?.tabData) {
      win.webContents.once('did-finish-load', () => {
        win.webContents.send(IPC_CHANNELS.TAB.DETACHED, options.tabData)
      })
    }

    return win
  }

  /**
   * 向指定窗口转发"合并标签"通知。
   */
  mergeTabToWindow(targetWindowId: number, tabData: DetachedTabData): boolean {
    const targetWindow = this.windows.get(targetWindowId)
    if (!targetWindow || targetWindow.isDestroyed()) {
      this.windows.delete(targetWindowId)
      return false
    }
    targetWindow.webContents.send(IPC_CHANNELS.TAB.MERGE, tabData)
    return true
  }

  /**
   * 聚焦指定窗口，并可选地通知它切换到某文件标签页。
   */
  focusWindow(windowId: number, filePath?: string): boolean {
    const win = this.windows.get(windowId)
    if (!win || win.isDestroyed()) return false
    if (win.isMinimized()) win.restore()
    win.focus()
    if (filePath) {
      win.webContents.send(IPC_CHANNELS.TAB.FOCUS_FOR_FILE, filePath)
    }
    return true
  }

  /**
   * 获取主屏幕信息，用于跨屏拖拽计算。
   */
  getPrimaryDisplay(): { x: number; y: number; width: number; height: number } {
    return screen.getPrimaryDisplay().bounds
  }

  private registerWindow(win: BrowserWindow): void {
    this.windows.set(win.id, win)
    this.windowOpenFiles.set(win.id, [])
  }
}
