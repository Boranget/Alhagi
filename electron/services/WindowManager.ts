// ============================================================
// Alhagi WindowManager - 窗口生命周期、打开文件追踪、新窗口创建
// ============================================================
//
// 持有所有 BrowserWindow，提供：
// - createMainWindow() / createNewWindow()
// - 窗口列表查询 / 跨窗口"该文件是否已打开"
// - 主进程发出去的 tab 跨窗口转发（merge/detach/focus-for-file）

import { BrowserWindow, screen, type Event as ElectronEvent } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC_CHANNELS, type DetachedTabData, type WindowMode } from '../../electron-protocol'
import type { PreferenceStore } from './PreferenceStore'
import type { ThemeService } from './ThemeService'
import { attachRendererCrashHandler } from './crashHandler'
import type { FileWatcher } from './FileWatcher'
import type { MenuBuilder } from './MenuBuilder'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_WINDOW_SIZE = { width: 1200, height: 800 }
const STICKY_WINDOW_SIZE = { width: 250, height: 300 }

export interface NewWindowOptions {
  bounds?: { x: number; y: number; width: number; height: number }
  filePath?: string
  tabData?: DetachedTabData
}

export class WindowManager {
  private windows = new Map<number, BrowserWindow>()
  private windowOpenFiles = new Map<number, string[]>()
  private mainWindow: BrowserWindow | null = null
  /** P2-10：可选注入；用于在 updateOpenedFiles 时同步监视列表 */
  private fileWatcher: FileWatcher | null = null
  /** 通过 setter 注入避免循环依赖（MenuBuilder 也要依赖 WindowManager） */
  private menu: MenuBuilder | null = null
  private pendingCloseWindows = new Set<number>()
  private allowedCloseWindows = new Set<number>()
  private windowModes = new Map<number, WindowMode>()
  private normalWindowBounds = new Map<number, { x: number; y: number; width: number; height: number }>()

  constructor(
    private prefs: PreferenceStore,
    private theme: ThemeService,
    private viteDevServerUrl: string | undefined,
    private rendererDist: string,
  ) {}

  /** P2-10：AppContext 在构造完 FileWatcher 后回调注入，避免循环依赖 */
  attachFileWatcher(watcher: FileWatcher): void {
    this.fileWatcher = watcher
  }

  /** AppContext 构造完 MenuBuilder 后回调注入。注入后续创建的窗口会自动获得专属菜单 */
  attachMenuBuilder(menu: MenuBuilder): void {
    this.menu = menu
  }

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
    const prev = this.windowOpenFiles.get(windowId) ?? []
    this.windowOpenFiles.set(windowId, filePaths)
    this.fileWatcher?.syncForWindow(prev, filePaths)
  }

  allowWindowClose(windowId: number, allowClose: boolean): boolean {
    const win = this.windows.get(windowId)
    this.pendingCloseWindows.delete(windowId)

    if (!win || win.isDestroyed()) return false
    if (!allowClose) return true

    this.allowedCloseWindows.add(windowId)
    win.close()
    return true
  }

  setWindowMode(windowId: number, mode: WindowMode): boolean {
    const win = this.windows.get(windowId)
    if (!win || win.isDestroyed()) return false

    const currentMode = this.windowModes.get(windowId) ?? 'normal'
    if (mode === currentMode) mode = 'normal'

    if (currentMode === 'normal' && mode !== 'normal') {
      this.normalWindowBounds.set(windowId, win.getBounds())
    }

    if (mode === 'normal') {
      if (win.isFullScreen()) win.setFullScreen(false)
      win.setAlwaysOnTop(false)
      win.setAutoHideMenuBar(false)
      win.setMenuBarVisibility(true)
      const bounds = this.normalWindowBounds.get(windowId)
      if (bounds) win.setBounds(bounds)
      else win.setSize(DEFAULT_WINDOW_SIZE.width, DEFAULT_WINDOW_SIZE.height)
      this.normalWindowBounds.delete(windowId)
    } else if (mode === 'sticky') {
      if (win.isFullScreen()) win.setFullScreen(false)
      win.setAlwaysOnTop(true)
      win.setMinimumSize(STICKY_WINDOW_SIZE.width, STICKY_WINDOW_SIZE.height)
      win.setSize(STICKY_WINDOW_SIZE.width, STICKY_WINDOW_SIZE.height)
    } else {
      win.setAlwaysOnTop(false)
      win.setFullScreen(true)
    }

    this.windowModes.set(windowId, mode)
    win.webContents.send(IPC_CHANNELS.WINDOW.MODE_CHANGED, mode)
    this.menu?.setLayoutItems(windowId, mode === 'normal')
    this.menu?.setModeItems(windowId, mode)
    return true
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

    win.on('close', (event) => {
      if (!this.handleCloseRequest(win, event)) return

      if (!win.isDestroyed()) {
        const bounds = this.normalWindowBounds.get(win.id) ?? win.getBounds()
        this.prefs.setWindowState({
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized: win.isMaximized() && (this.windowModes.get(win.id) ?? 'normal') === 'normal',
        })
      }
    })

    win.on('closed', () => {
      // 释放该窗口持有的文件监视引用计数（P2-10）
      const prevFiles = this.windowOpenFiles.get(win.id) ?? []
      this.fileWatcher?.syncForWindow(prevFiles, [])
      this.windows.delete(win.id)
      this.windowOpenFiles.delete(win.id)
      this.pendingCloseWindows.delete(win.id)
      this.allowedCloseWindows.delete(win.id)
      this.windowModes.delete(win.id)
      this.normalWindowBounds.delete(win.id)
      this.menu?.removeWindow(win.id)
      if (this.mainWindow === win) {
        this.mainWindow = null
      }
    })

    win.on('leave-full-screen', () => {
      if ((this.windowModes.get(win.id) ?? 'normal') === 'immersive') {
        this.setWindowMode(win.id, 'normal')
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

    win.on('close', (event) => {
      this.handleCloseRequest(win, event)
    })

    win.on('closed', () => {
      const prevFiles = this.windowOpenFiles.get(win.id) ?? []
      this.fileWatcher?.syncForWindow(prevFiles, [])
      this.windows.delete(win.id)
      this.windowOpenFiles.delete(win.id)
      this.pendingCloseWindows.delete(win.id)
      this.allowedCloseWindows.delete(win.id)
      this.windowModes.delete(win.id)
      this.normalWindowBounds.delete(win.id)
      this.menu?.removeWindow(win.id)
    })

    win.on('leave-full-screen', () => {
      if ((this.windowModes.get(win.id) ?? 'normal') === 'immersive') {
        this.setWindowMode(win.id, 'normal')
      }
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

  private handleCloseRequest(win: BrowserWindow, event: ElectronEvent): boolean {
    const windowId = win.id

    if (this.allowedCloseWindows.has(windowId)) {
      this.allowedCloseWindows.delete(windowId)
      return true
    }

    event.preventDefault()

    if (this.pendingCloseWindows.has(windowId)) return false

    this.pendingCloseWindows.add(windowId)
    win.webContents.send(IPC_CHANNELS.WINDOW.CLOSE_REQUEST)
    return false
  }

  private registerWindow(win: BrowserWindow): void {
    this.windows.set(win.id, win)
    this.windowOpenFiles.set(win.id, [])
    // P2-11：渲染进程崩溃时弹 Reload / Close 对话框
    attachRendererCrashHandler(win)

    // 给该窗口绑定专属菜单（per-window layout：A 关侧栏不影响 B）。
    // macOS 上还要在 focus 时把该窗的菜单切换为应用菜单 —— 监听器先 attach
    // 再 install，避免新窗口 ready-to-show 后立刻 focus 时漏了第一次切换。
    if (process.platform === 'darwin') {
      win.on('focus', () => this.menu?.onWindowFocus(win))
    }
    this.menu?.installForWindow(win)
  }
}
