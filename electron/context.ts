// ============================================================
// Alhagi AppContext - 主进程服务容器（借鉴 Muya Accessor 模式）
// ============================================================
//
// 入口处按固定顺序构造全部服务，相互通过构造函数注入。
// 任何模块都从 AppContext 取依赖，不再直接 import 单例或读 global。

import { ipcMain } from 'electron'
import { PreferenceStore } from './services/PreferenceStore'
import { ThemeService } from './services/ThemeService'
import { WindowManager } from './services/WindowManager'
import { FileSystemService } from './services/FileSystemService'
import { DialogService } from './services/DialogService'
import { SearchService } from './services/SearchService'
import { WindowIpcHandlers } from './services/WindowIpcHandlers'
import { PreferenceIpcHandlers } from './services/PreferenceIpcHandlers'
import { MenuBuilder } from './services/MenuBuilder'
import { FileWatcher } from './services/FileWatcher'
import { ClipboardService } from './services/ClipboardService'
import { MAIN_PROCESS_COMMANDS } from './services/menu/mainProcessCommands'
import { IPC_CHANNELS } from '../electron-protocol/channels'
import type { Language } from '../electron-protocol/i18n/dictionaries'

export class AppContext {
  readonly prefs: PreferenceStore
  readonly theme: ThemeService
  readonly windowManager: WindowManager
  readonly fileSystem: FileSystemService
  readonly dialog: DialogService
  readonly search: SearchService
  readonly windowIpc: WindowIpcHandlers
  readonly preferenceIpc: PreferenceIpcHandlers
  readonly menu: MenuBuilder
  readonly fileWatcher: FileWatcher
  readonly clipboard: ClipboardService

  constructor(viteDevServerUrl: string | undefined, rendererDist: string) {
    // 构造顺序按依赖关系排列：
    // PreferenceStore → ThemeService → WindowManager → FileWatcher → 其余 IPC 服务 → MenuBuilder
    this.prefs = new PreferenceStore()
    this.theme = new ThemeService(this.prefs)
    this.windowManager = new WindowManager(this.prefs, this.theme, viteDevServerUrl, rendererDist)
    this.fileWatcher = new FileWatcher(this.windowManager)
    this.windowManager.attachFileWatcher(this.fileWatcher)
    this.fileSystem = new FileSystemService(this.windowManager, this.fileWatcher)
    this.dialog = new DialogService(this.windowManager)
    this.search = new SearchService()
    this.windowIpc = new WindowIpcHandlers(this.windowManager, this.theme)
    this.preferenceIpc = new PreferenceIpcHandlers(this.prefs)
    this.menu = new MenuBuilder(this.windowManager)
    this.clipboard = new ClipboardService()
  }

  /**
   * 在 app.whenReady() 之后调用：注册全部 IPC handler，构建菜单，创建主窗口。
   */
  start(): void {
    this.fileSystem.registerHandlers()
    this.dialog.registerHandlers()
    this.search.registerHandlers()
    this.windowIpc.registerHandlers()
    this.preferenceIpc.registerHandlers()
    this.clipboard.registerHandlers()
    this.registerMenuHandlers()
    // 启动菜单语言：从偏好读取（兼容首次启动 / 旧用户）
    const initialLang = this.readPreferredLanguage()
    this.menu.install(initialLang)
    this.windowManager.createMainWindow()
  }

  private registerMenuHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.MENU.REBUILD, (_event, language: Language) => {
      this.menu.rebuild(language)
      return { success: true, data: true }
    })

    // 渲染端命令面板/快捷键触发 main-only 命令（如 fullscreen/devTools/stickyNote）时，
    // 通过这一通道让主进程执行，与菜单 click 走同一份实现。
    ipcMain.handle(IPC_CHANNELS.COMMAND.EXECUTE_MAIN, (_event, commandId: string) => {
      const handler = MAIN_PROCESS_COMMANDS[commandId]
      if (!handler) return { success: false, data: false }
      handler({ windowManager: this.windowManager })
      return { success: true, data: true }
    })
  }

  private readPreferredLanguage(): Language {
    // 从用户偏好中读语言（首次启动时为 null，回退 zh-CN）
    try {
      const prefs = this.prefs.getUserPreferences()
      const lang = prefs?.language
      if (lang === 'en' || lang === 'zh-CN') return lang
    } catch {
      // 偏好读取失败时回退默认
    }
    return 'zh-CN'
  }
}
