// ============================================================
// Alhagi SettingsWindowManager - 独立设置窗的生命周期
// ============================================================
//
// 设置窗是与主窗 **解耦** 的独立 BrowserWindow：
//   - 不挂为 main 的 child（用户可拖到主窗外、独立最小化/最大化）；
//   - 单例：已存在则聚焦，再次调用 open() 不会创建第二个；
//   - 自身的窗口几何状态独立持久化（PreferenceStore.settingsWindowState）；
//   - 加载独立 HTML 入口 settings.html（vite 多入口构建产物）。
//
// 与 WindowManager 平级，不共享 windows Map —— 设置窗不应出现在
// "全部窗口列表"（标签页合并、详情查询等业务里）。

import { BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PreferenceStore } from './PreferenceStore'
import type { ThemeService } from './ThemeService'
import { attachRendererCrashHandler } from './crashHandler'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class SettingsWindowManager {
  private window: BrowserWindow | null = null

  constructor(
    private prefs: PreferenceStore,
    private theme: ThemeService,
    private viteDevServerUrl: string | undefined,
    private rendererDist: string,
  ) {}

  /**
   * 打开设置窗。已存在则聚焦（含取消最小化），不重复创建。
   * 返回 true 表示成功（无论是新建还是聚焦）。
   */
  open(): boolean {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore()
      this.window.focus()
      return true
    }
    this.window = this.create()
    return true
  }

  /** 渲染端主动请求关闭 / 主程序退出时清理 */
  close(): void {
    if (this.window && !this.window.isDestroyed()) this.window.close()
  }

  /** 当前设置窗（broadcaster 需要拿到它的 webContents 决定是否广播） */
  getWindow(): BrowserWindow | null {
    return this.window
  }

  private create(): BrowserWindow {
    const state = this.prefs.getSettingsWindowState()
    const backgroundColor = this.theme.getBackgroundColor()

    const win = new BrowserWindow({
      width: state.width,
      height: state.height,
      x: state.x,
      y: state.y,
      minWidth: 600,
      minHeight: 400,
      title: '设置',
      // 设置窗使用纯自绘 chrome —— SettingsPanel 内部的 header 已是面板风格，
      // OS 标题栏冗余。frame:false 完全隐藏 OS chrome（标题栏 + 边框 + 菜单栏）。
      // SettingsPanel 内的 .settings-header 用 -webkit-app-region: drag 提供拖拽区，
      // 关闭按钮保留 SettingsPanel 自身的 .close-btn。
      frame: false,
      // 多保险：部分平台（Linux）即使 frame:false 仍可能通过 Alt 键展开菜单。
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
      backgroundColor,
    })

    // 主进程级菜单清理 —— frame:false 通常已隐藏，但 setMenu(null) 是确定性彻底
    // 移除菜单的方式，避免设置窗里出现编辑器主菜单。
    win.setMenu(null)

    attachRendererCrashHandler(win)

    win.on('ready-to-show', () => {
      if (state.isMaximized) win.maximize()
      win.show()
    })

    win.on('close', () => {
      // 持久化窗口位置/最大化状态，下次开启在原处复现
      if (!win.isDestroyed()) {
        const bounds = win.getBounds()
        this.prefs.setSettingsWindowState({
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized: win.isMaximized(),
        })
      }
    })

    win.on('closed', () => {
      this.window = null
    })

    if (this.viteDevServerUrl) {
      // dev 服务器：'<base>/settings.html'
      const url = this.viteDevServerUrl.endsWith('/')
        ? `${this.viteDevServerUrl}settings.html`
        : `${this.viteDevServerUrl}/settings.html`
      win.loadURL(url)
      // 开发期：F12 / Ctrl+Shift+I 打开 DevTools。生产构建禁用。
      // frame:false 没菜单栏，标准 Electron DevTools 快捷键不生效，需手动绑。
      win.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown') return
        const isF12 = input.key === 'F12'
        const isCtrlShiftI = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i'
        if (isF12 || isCtrlShiftI) {
          win.webContents.toggleDevTools()
          event.preventDefault()
        }
      })
    } else {
      win.loadFile(path.join(this.rendererDist, 'settings.html'))
    }

    return win
  }
}
