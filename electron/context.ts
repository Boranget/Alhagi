// ============================================================
// Alhagi AppContext - 主进程服务容器（借鉴 Muya Accessor 模式）
// ============================================================
//
// 入口处按固定顺序构造全部服务，相互通过构造函数注入。
// 任何模块都从 AppContext 取依赖，不再直接 import 单例或读 global。

import { PreferenceStore } from './services/PreferenceStore'
import { ThemeService } from './services/ThemeService'
import { WindowManager } from './services/WindowManager'
import { FileSystemService } from './services/FileSystemService'
import { DialogService } from './services/DialogService'
import { SearchService } from './services/SearchService'
import { WindowIpcHandlers } from './services/WindowIpcHandlers'
import { PreferenceIpcHandlers } from './services/PreferenceIpcHandlers'
import { MenuBuilder } from './services/MenuBuilder'

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

  constructor(viteDevServerUrl: string | undefined, rendererDist: string) {
    // 构造顺序按依赖关系排列：
    // PreferenceStore → ThemeService → WindowManager → 其余 IPC 服务 → MenuBuilder
    this.prefs = new PreferenceStore()
    this.theme = new ThemeService(this.prefs)
    this.windowManager = new WindowManager(this.prefs, this.theme, viteDevServerUrl, rendererDist)
    this.fileSystem = new FileSystemService(this.windowManager)
    this.dialog = new DialogService(this.windowManager)
    this.search = new SearchService()
    this.windowIpc = new WindowIpcHandlers(this.windowManager, this.theme)
    this.preferenceIpc = new PreferenceIpcHandlers(this.prefs)
    this.menu = new MenuBuilder(this.windowManager)
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
    this.menu.install()
    this.windowManager.createMainWindow()
  }
}
