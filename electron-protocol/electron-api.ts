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
  setZoom: (zoomLevel: number) => Promise<IPCResponse<void>>
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<IPCResponse<void>>

  // ========== 偏好持久化 ==========
  /** 读取全部用户偏好（主进程 electron-store）。返回 null 表示从未保存过。 */
  preferencesGetAll: () => Promise<IPCResponse<Record<string, unknown> | null>>
  /** 保存全部用户偏好。整体覆写，调用方负责合并增量。 */
  preferencesSetAll: (prefs: Record<string, unknown>) => Promise<IPCResponse<boolean>>

  // ========== 主进程 → 渲染端事件订阅 ==========
  // 每个 on* 方法接收一个回调，返回一个取消订阅函数。
  onDragStart: (callback: (tabId: string) => void) => () => void
  onDragEnd: (callback: () => void) => () => void
  onNewFile: (callback: () => void) => () => void
  onNewWindow: (callback: () => void) => () => void
  onOpenFile: (callback: () => void) => () => void
  onOpenFolder: (callback: () => void) => () => void
  onSave: (callback: () => void) => () => void
  onSaveAs: (callback: () => void) => () => void
  onViewMode: (callback: (mode: string) => void) => () => void
  onCopyAsMarkdown: (callback: () => void) => () => void
  onCopyAsHtml: (callback: () => void) => () => void
  onPasteAsPlain: (callback: () => void) => () => void
  onCaptureScreen: (callback: () => void) => () => void
  onTabMerge: (callback: (tabData: DetachedTabData) => void) => () => void
  onTabDetached: (callback: (tabData: DetachedTabData) => void) => () => void
  onFocusTabForFile: (callback: (filePath: string) => void) => () => void
  onToggleStickyNoteMode: (callback: () => void) => () => void
  onToggleImmersiveMode: (callback: () => void) => () => void
  onToggleSidebar: (callback: () => void) => () => void
  onToggleTabBar: (callback: () => void) => () => void
  onToggleStatusBar: (callback: () => void) => () => void
  onToggleTheme: (callback: () => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
  onZoomIn: (callback: () => void) => () => void
  onZoomOut: (callback: () => void) => () => void
  onZoomReset: (callback: () => void) => () => void
  onEditUndo: (callback: () => void) => () => void
  onEditRedo: (callback: () => void) => () => void
  onEditFind: (callback: () => void) => () => void

  // 段落菜单事件
  onParagraphHeading1: (callback: () => void) => () => void
  onParagraphHeading2: (callback: () => void) => () => void
  onParagraphHeading3: (callback: () => void) => () => void
  onParagraphParagraph: (callback: () => void) => () => void
  onParagraphQuote: (callback: () => void) => () => void
  onParagraphBulletList: (callback: () => void) => () => void
  onParagraphOrderedList: (callback: () => void) => () => void
  onParagraphTaskList: (callback: () => void) => () => void
  onParagraphCodeBlock: (callback: () => void) => () => void
  onParagraphMathBlock: (callback: () => void) => () => void
  onParagraphHorizontalRule: (callback: () => void) => () => void

  // 表格菜单事件
  onTableInsert: (callback: () => void) => () => void
  onTableInsertRowAbove: (callback: () => void) => () => void
  onTableInsertRowBelow: (callback: () => void) => () => void
  onTableInsertColumnLeft: (callback: () => void) => () => void
  onTableInsertColumnRight: (callback: () => void) => () => void
  onTableDeleteRow: (callback: () => void) => () => void
  onTableDeleteColumn: (callback: () => void) => () => void

  // 导航菜单事件
  onNavigationQuickOpen: (callback: () => void) => () => void
  onNavigationGotoLine: (callback: () => void) => () => void

  // 工具菜单事件
  onToolsPreferences: (callback: () => void) => () => void
  onToolsExport: (callback: () => void) => () => void

  // 帮助菜单事件
  onHelpShortcuts: (callback: () => void) => () => void
}
