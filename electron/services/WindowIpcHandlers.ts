// ============================================================
// Alhagi WindowIpcHandlers - 窗口相关 IPC 注册
// ============================================================
//
// 这里"很薄"，只把渲染端的窗口请求路由到 WindowManager / ThemeService。

import { BrowserWindow } from 'electron'
import {
  IPC_CHANNELS,
  IPCErrorCode,
  createSuccessResponse,
  createErrorResponse,
  type DetachedTabData,
} from '../../electron-protocol'
import { registerHandler } from '../ipc-handler'
import type { WindowManager } from './WindowManager'
import type { ThemeService } from './ThemeService'

export class WindowIpcHandlers {
  constructor(
    private windowManager: WindowManager,
    private themeService: ThemeService,
  ) {}

  registerHandlers(): void {
    this.registerBasicWindowOps()
    this.registerWindowDiscovery()
    this.registerNewWindow()
    this.registerMergeTab()
    this.registerFocusWindow()
    this.registerFileTracking()
    this.registerCursorAndScreen()
    this.registerDevTools()
    this.registerZoomAndTheme()
  }

  private registerBasicWindowOps(): void {
    registerHandler(IPC_CHANNELS.WINDOW.MINIMIZE, IPCErrorCode.UNKNOWN_ERROR, () => {
      this.windowManager.getMainWindow()?.minimize()
      return undefined
    })

    registerHandler(IPC_CHANNELS.WINDOW.MAXIMIZE, IPCErrorCode.UNKNOWN_ERROR, () => {
      const win = this.windowManager.getMainWindow()
      if (win?.isMaximized()) win.unmaximize()
      else win?.maximize()
      return undefined
    })

    registerHandler(IPC_CHANNELS.WINDOW.CLOSE, IPCErrorCode.UNKNOWN_ERROR, () => {
      this.windowManager.getMainWindow()?.close()
      return undefined
    })

    registerHandler(IPC_CHANNELS.WINDOW.SET_ALWAYS_ON_TOP, IPCErrorCode.UNKNOWN_ERROR, (_, flag: boolean) => {
      this.windowManager.getMainWindow()?.setAlwaysOnTop(flag)
      return undefined
    })
  }

  private registerWindowDiscovery(): void {
    registerHandler(IPC_CHANNELS.WINDOW.GET_WINDOW_ID, IPCErrorCode.UNKNOWN_ERROR, (event) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      return window?.id || null
    })

    registerHandler(IPC_CHANNELS.WINDOW.LIST_WINDOWS, IPCErrorCode.UNKNOWN_ERROR, () => {
      return this.windowManager.listWindows()
    })
  }

  private registerNewWindow(): void {
    registerHandler(
      IPC_CHANNELS.WINDOW.OPEN_NEW_WINDOW,
      IPCErrorCode.UNKNOWN_ERROR,
      (_, options?: { bounds?: { x: number; y: number; width: number; height: number }; filePath?: string; tabData?: DetachedTabData }) => {
        const win = this.windowManager.createNewWindow(options)
        return createSuccessResponse(win.id)
      },
    )
  }

  private registerMergeTab(): void {
    registerHandler(
      IPC_CHANNELS.WINDOW.MERGE_TAB,
      IPCErrorCode.UNKNOWN_ERROR,
      (_, { tabData, targetWindowId }: { tabData: DetachedTabData; targetWindowId: number }) => {
        const ok = this.windowManager.mergeTabToWindow(targetWindowId, tabData)
        if (!ok) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Target window not found or destroyed')
        return createSuccessResponse(true)
      },
    )
  }

  private registerFocusWindow(): void {
    registerHandler(
      IPC_CHANNELS.WINDOW.FOCUS_WINDOW,
      IPCErrorCode.UNKNOWN_ERROR,
      (_, windowId: number, filePath?: string) => {
        const ok = this.windowManager.focusWindow(windowId, filePath)
        if (!ok) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not found')
        return createSuccessResponse(true)
      },
    )
  }

  private registerFileTracking(): void {
    registerHandler(
      IPC_CHANNELS.WINDOW.CHECK_FILE_OPEN,
      IPCErrorCode.UNKNOWN_ERROR,
      (event, filePath: string) => {
        const currentWindow = BrowserWindow.fromWebContents(event.sender)
        const targetWindowId = this.windowManager.findWindowWithFile(filePath, currentWindow?.id)
        return { windowId: targetWindowId }
      },
    )

    registerHandler(
      IPC_CHANNELS.WINDOW.UPDATE_OPENED_FILES,
      IPCErrorCode.UNKNOWN_ERROR,
      (event, filePaths: string[]) => {
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not found')
        this.windowManager.updateOpenedFiles(window.id, filePaths)
        return createSuccessResponse(true)
      },
    )
  }

  private registerCursorAndScreen(): void {
    registerHandler(IPC_CHANNELS.WINDOW.GET_CURSOR_SCREEN_POINT, IPCErrorCode.UNKNOWN_ERROR, (event) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not found')
      const bounds = window.getBounds()
      return { x: bounds.x, y: bounds.y }
    })

    registerHandler(IPC_CHANNELS.WINDOW.GET_SCREEN_DISPLAY, IPCErrorCode.UNKNOWN_ERROR, () => {
      return this.windowManager.getPrimaryDisplay()
    })
  }

  private registerDevTools(): void {
    registerHandler(IPC_CHANNELS.WINDOW.OPEN_DEV_TOOLS, IPCErrorCode.UNKNOWN_ERROR, () => {
      this.windowManager.getMainWindow()?.webContents.openDevTools()
      return true
    })
  }

  private registerZoomAndTheme(): void {
    registerHandler(IPC_CHANNELS.WINDOW.SET_ZOOM, IPCErrorCode.UNKNOWN_ERROR, (event, zoomLevel: number) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not found')
      window.webContents.setZoomFactor(zoomLevel / 100)
      return undefined
    })

    registerHandler(IPC_CHANNELS.WINDOW.SET_THEME, IPCErrorCode.UNKNOWN_ERROR, (_, theme: 'light' | 'dark' | 'system') => {
      this.themeService.setTheme(theme, this.windowManager.getAllWindows())
      return undefined
    })
  }
}
