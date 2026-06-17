// ============================================================
// Alhagi ElectronAPI 接口定义
// ============================================================
//
// preload.ts 的 contextBridge.exposeInMainWorld('electronAPI', api) 必须
// 严格实现这个接口；渲染端的 ElectronService 也只能调用此接口中声明的方法。
//
// 若需要新增/删除方法，必须三处同步：本接口 → preload.ts → ElectronService.ts，
// 否则会出现幽灵 API（接口声明了但 preload 没暴露，运行时 undefined）。

import type { IPCResponse } from './responses'
import type {
  FileTreeNode,
  DirectoryEntry,
  SearchOptions,
  SearchResult,
  LineEnding,
  DetachedTabData,
} from './types'
import type { Language } from './i18n/dictionaries'

export interface ElectronAPI {
  // ========== 文件操作 ==========
  openFile: () => Promise<IPCResponse<{ filePath: string; content: string } | null>>
  saveFile: (filePath: string, content: string, lineEnding?: LineEnding) => Promise<IPCResponse<boolean>>
  saveAsFile: (content: string, defaultPath?: string, lineEnding?: LineEnding) => Promise<IPCResponse<string | null>>
  saveBinaryFile: (filePath: string, content: string) => Promise<IPCResponse<boolean>>
  readFile: (filePath: string) => Promise<IPCResponse<string>>
  readBinaryFile: (filePath: string) => Promise<IPCResponse<string>>
  openFolder: () => Promise<IPCResponse<{ path: string; tree: FileTreeNode[] } | null>>
  readDirectory: (dirPath: string) => Promise<IPCResponse<DirectoryEntry[]>>
  createFile: (dirPath: string, fileName: string) => Promise<IPCResponse<string | null>>
  createDirectory: (dirPath: string, dirName: string) => Promise<IPCResponse<string | null>>
  deleteFile: (filePath: string) => Promise<IPCResponse<boolean>>
  renameFile: (oldPath: string, newName: string) => Promise<IPCResponse<string | null>>
  moveFile: (sourcePath: string, targetDir: string) => Promise<IPCResponse<string | null>>
  copyFile: (sourcePath: string, targetDir: string) => Promise<IPCResponse<string | null>>
  selectDirectory: () => Promise<IPCResponse<string | null>>
  showInFolder: (filePath: string) => Promise<IPCResponse<boolean>>
  searchInDirectory: (dirPath: string, query: string, options?: SearchOptions) => Promise<IPCResponse<SearchResult[]>>
  getDocumentsDirectory: () => Promise<IPCResponse<string>>
  ensureDirectory: (dirPath: string) => Promise<IPCResponse<boolean>>

  // ========== 窗口操作 ==========
  minimize: () => Promise<IPCResponse<void>>
  maximize: () => Promise<IPCResponse<void>>
  close: () => Promise<IPCResponse<void>>
  setAlwaysOnTop: (flag: boolean) => Promise<IPCResponse<void>>
  getCursorScreenPoint: () => Promise<IPCResponse<{ x: number; y: number } | null>>
  getScreenDisplay: () => Promise<IPCResponse<{ x: number; y: number; width: number; height: number } | null>>
  openDevTools: () => Promise<IPCResponse<boolean>>
  openNewWindow: (options?: {
    filePath?: string
    tabData?: DetachedTabData
    bounds?: { x: number; y: number; width: number; height: number }
  }) => Promise<IPCResponse<boolean | number>>
  mergeTab: (tabData: DetachedTabData, targetWindowId: number) => Promise<IPCResponse<boolean>>
  getWindowId: () => Promise<IPCResponse<number | null>>
  listWindows: () => Promise<IPCResponse<Array<{
    id: number
    title: string
    bounds: { x: number; y: number; width: number; height: number }
  }>>>
  focusWindow: (windowId: number, filePath?: string) => Promise<IPCResponse<boolean>>
  checkFileOpen: (filePath: string) => Promise<IPCResponse<{ windowId: number | null }>>
  updateOpenedFiles: (filePaths: string[]) => Promise<IPCResponse<boolean>>
  closeResponse: (allowClose: boolean) => Promise<IPCResponse<boolean>>
  onCloseRequest: (callback: () => void) => () => void
  setZoom: (zoomLevel: number) => Promise<IPCResponse<void>>
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<IPCResponse<void>>

  // ========== 偏好持久化（Single-Writer 模式） ==========
  /** 读取全部用户偏好（启动时一次性灌入 store）。返回 null 表示从未保存过。 */
  preferencesGetAll: () => Promise<IPCResponse<Record<string, unknown> | null>>
  /** 整体覆写用户偏好。仅供 localStorage→electron-store 迁移使用，UI 路径不应调用。 */
  preferencesSetAll: (prefs: Record<string, unknown>) => Promise<IPCResponse<boolean>>
  /**
   * 单字段写入 —— UI 操作的唯一入口。
   * 主进程写盘后通过 onPreferencesChanged 把同样的 patch 广播给所有窗口
   * （含发起方），各窗口收到才更新本地 ref。这是 single-writer 模式：
   * 渲染端永远不直接写本地 store，所有变更都先经主进程。
   */
  preferencesSetOne: (key: string, value: unknown) => Promise<IPCResponse<boolean>>
  /**
   * 订阅偏好变更广播。payload 是 patch（仅含本次变化的字段），
   * 渲染端 store 用其更新本地 ref —— 这是渲染端唯一写入路径。
   */
  onPreferencesChanged: (
    callback: (patch: Record<string, unknown>) => void
  ) => () => void

  // ========== 独立设置窗口（与主窗解耦） ==========
  /** 主窗请求打开设置窗。已存在则聚焦，永远只有一个设置窗实例。 */
  openSettings: () => Promise<IPCResponse<boolean>>

  // ========== 命令 & 菜单（P2-12） ==========
  /**
   * 订阅主进程通过统一通道下发的命令执行通知。
   * 菜单点击会通过此通道传 commandId，渲染端调 executeCommand(id) 派发。
   */
  onExecuteCommand: (callback: (commandId: string) => void) => () => void
  /**
   * 通知主进程按指定语言重建原生应用菜单（语言切换、命令注册表热更新场景）。
   */
  rebuildMenu: (language: Language) => Promise<IPCResponse<boolean>>
  /**
   * 让主进程执行 mainProcessCommands 表中的命令（如 fullscreen/devTools/stickyNote.window），
   * 命令面板/快捷键触发时与菜单点击共用同一份主进程实现。
   * 命令 ID 不在表中返回 success=false。
   */
  executeMainCommand: (commandId: string) => Promise<IPCResponse<boolean>>

  /**
   * 读取系统剪贴板中的图片，返回 PNG base64（无 `data:` 前缀）。
   * 截图等场景下比渲染端 FileReader 快得多。剪贴板无图片时返回 null。
   */
  readClipboardImage: () => Promise<IPCResponse<{ base64: string; width: number; height: number } | null>>

  // ========== 窗口运行期布局 ==========
  /**
   * 通知主进程：本窗口某个 layout 开关变了。
   * 主进程会按窗口 id in-place 修改对应菜单 checkbox 的 checked 状态，
   * 不持久化、不重建菜单。payload 中可只携带变化的字段。
   */
  layoutChanged: (payload: {
    showSidebar?: boolean
    showTabBar?: boolean
    showStatusBar?: boolean
  }) => Promise<IPCResponse<boolean>>

  // ========== 文件外部修改检测（P2-10） ==========
  /**
   * 订阅「已打开文件被外部修改/删除」通知。
   * kind: 'modified' — 内容变化，建议提示用户重新加载
   *       'deleted'  — 文件已被删除（或重命名走了），建议标脏或关闭标签
   */
  onExternalFileChanged: (
    callback: (payload: { filePath: string; kind: 'modified' | 'deleted' }) => void
  ) => () => void

  // ========== 跨窗口标签操作（main → renderer） ==========
  /** 其他窗口请求把 tab 合并到本窗口 */
  onTabMerge: (callback: (tabData: DetachedTabData) => void) => () => void
  /** 本窗口被作为分离 tab 的目标窗口创建时，传入初始 tab 数据 */
  onTabDetached: (callback: (tabData: DetachedTabData) => void) => () => void
  /** 通知本窗口聚焦到对应文件的 tab（用户从其他窗口请求打开已打开的文件时）*/
  onFocusTabForFile: (callback: (filePath: string) => void) => () => void
}
