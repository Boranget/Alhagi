import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import {
  IPCResponse,
  ElectronAPI,
  IPC_CHANNELS,
  FILE_TYPES,
  DetachedTabData,
} from '../electron-protocol'
import type { Language } from '../electron-protocol/i18n/dictionaries'

export type { IPCResponse, DetachedTabData } from '../electron-protocol'

function createIpcHandler<T>(
  channel: string,
  ...args: unknown[]
): Promise<IPCResponse<T>> {
  return ipcRenderer.invoke(channel, ...args)
}

function createListener<TArgs extends unknown[]>(
  channel: string,
  callback: (...args: TArgs) => void
): () => void {
  const handler = (_event: IpcRendererEvent, ...args: unknown[]) =>
    (callback as (...args: unknown[]) => void)(...args)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: ElectronAPI = {
  // ========== 文件操作 ==========
  openFile: () => createIpcHandler(IPC_CHANNELS.FILE.OPEN),

  saveFile: (filePath, content, lineEnding) =>
    createIpcHandler(IPC_CHANNELS.FILE.SAVE, { filePath, content, lineEnding }),

  saveAsFile: (content, defaultPath, lineEnding) =>
    createIpcHandler(IPC_CHANNELS.FILE.SAVE_AS, { content, defaultPath, lineEnding }),

  saveBinaryFile: (filePath, content) =>
    createIpcHandler(IPC_CHANNELS.FILE.SAVE_BINARY, { filePath, content }),

  readFile: (filePath) =>
    createIpcHandler(IPC_CHANNELS.FILE.READ, filePath),

  readBinaryFile: (filePath) =>
    createIpcHandler(IPC_CHANNELS.FILE.READ_BINARY, filePath),

  openFolder: () =>
    createIpcHandler(IPC_CHANNELS.FILE.OPEN_FOLDER),

  readDirectory: (dirPath) =>
    createIpcHandler(IPC_CHANNELS.FILE.READ_DIRECTORY, dirPath),

  createFile: (dirPath, fileName) =>
    createIpcHandler(IPC_CHANNELS.FILE.CREATE, { dirPath, fileName, type: FILE_TYPES.FILE }),

  createDirectory: (dirPath, dirName) =>
    createIpcHandler(IPC_CHANNELS.FILE.CREATE, { dirPath, fileName: dirName, type: FILE_TYPES.DIRECTORY }),

  deleteFile: (filePath) =>
    createIpcHandler(IPC_CHANNELS.FILE.DELETE, filePath),

  renameFile: (oldPath, newName) =>
    createIpcHandler(IPC_CHANNELS.FILE.RENAME, { oldPath, newName }),

  moveFile: (sourcePath, targetDir) =>
    createIpcHandler(IPC_CHANNELS.FILE.MOVE, { sourcePath, targetDir }),

  copyFile: (sourcePath, targetDir) =>
    createIpcHandler(IPC_CHANNELS.FILE.COPY, { sourcePath, targetDir }),

  getDocumentsDirectory: () =>
    createIpcHandler(IPC_CHANNELS.FILE.GET_DOCUMENTS_DIRECTORY),

  ensureDirectory: (dirPath) =>
    createIpcHandler(IPC_CHANNELS.FILE.ENSURE_DIRECTORY, dirPath),

  selectDirectory: () =>
    createIpcHandler(IPC_CHANNELS.DIALOG.SELECT_DIRECTORY),

  showInFolder: (filePath) =>
    createIpcHandler(IPC_CHANNELS.FILE.SHOW_IN_FOLDER, filePath),

  searchInDirectory: (dirPath, query, options) =>
    createIpcHandler(IPC_CHANNELS.FILE.SEARCH_IN_DIRECTORY, { dirPath, query, options }),

  // ========== 窗口操作 ==========
  minimize: () =>
    createIpcHandler(IPC_CHANNELS.WINDOW.MINIMIZE),

  maximize: () =>
    createIpcHandler(IPC_CHANNELS.WINDOW.MAXIMIZE),

  close: () =>
    createIpcHandler(IPC_CHANNELS.WINDOW.CLOSE),

  setAlwaysOnTop: (flag) =>
    createIpcHandler(IPC_CHANNELS.WINDOW.SET_ALWAYS_ON_TOP, flag),

  openNewWindow: (options?: { filePath?: string; tabData?: DetachedTabData; bounds?: { x: number; y: number; width?: number; height?: number } }) =>
    createIpcHandler(IPC_CHANNELS.WINDOW.OPEN_NEW_WINDOW, options),

  getCursorScreenPoint: () =>
    createIpcHandler(IPC_CHANNELS.WINDOW.GET_CURSOR_SCREEN_POINT),

  getScreenDisplay: () =>
    createIpcHandler(IPC_CHANNELS.WINDOW.GET_SCREEN_DISPLAY),

  openDevTools: () =>
    createIpcHandler(IPC_CHANNELS.WINDOW.OPEN_DEV_TOOLS),

  mergeTab: (tabData: DetachedTabData, targetWindowId: number) =>
    createIpcHandler(IPC_CHANNELS.WINDOW.MERGE_TAB, { tabData, targetWindowId }),

  getWindowId: () =>
    createIpcHandler(IPC_CHANNELS.WINDOW.GET_WINDOW_ID),

  listWindows: () =>
    createIpcHandler(IPC_CHANNELS.WINDOW.LIST_WINDOWS),

  focusWindow: (windowId: number, filePath?: string) =>
    createIpcHandler(IPC_CHANNELS.WINDOW.FOCUS_WINDOW, windowId, filePath),

  checkFileOpen: (filePath: string) =>
    createIpcHandler(IPC_CHANNELS.WINDOW.CHECK_FILE_OPEN, filePath),

  updateOpenedFiles: (filePaths: string[]) =>
    createIpcHandler(IPC_CHANNELS.WINDOW.UPDATE_OPENED_FILES, filePaths),

  closeResponse: (allowClose: boolean) =>
    createIpcHandler<boolean>(IPC_CHANNELS.WINDOW.CLOSE_RESPONSE, allowClose),

  onCloseRequest: (callback) =>
    createListener<[]>(IPC_CHANNELS.WINDOW.CLOSE_REQUEST, callback),

  setZoom: (zoomLevel: number) =>
    createIpcHandler(IPC_CHANNELS.WINDOW.SET_ZOOM, zoomLevel),

  setTheme: (theme: 'light' | 'dark' | 'system') =>
    createIpcHandler(IPC_CHANNELS.WINDOW.SET_THEME, theme),

  // ========== 偏好持久化（Single-Writer 模式） ==========
  preferencesGetAll: () =>
    createIpcHandler(IPC_CHANNELS.PREFERENCES.GET_ALL),

  preferencesSetAll: (prefs: Record<string, unknown>) =>
    createIpcHandler(IPC_CHANNELS.PREFERENCES.SET_ALL, prefs),

  preferencesSetOne: (key: string, value: unknown) =>
    createIpcHandler<boolean>(IPC_CHANNELS.PREFERENCES.SET_ONE, { key, value }),

  onPreferencesChanged: (callback) =>
    createListener<[Record<string, unknown>]>(
      IPC_CHANNELS.PREFERENCES.CHANGED,
      callback,
    ),

  // ========== 独立设置窗口 ==========
  openSettings: () =>
    createIpcHandler<boolean>(IPC_CHANNELS.SETTINGS.OPEN),

  // ========== 命令 & 菜单（P2-12） ==========
  onExecuteCommand: (callback: (commandId: string) => void) =>
    createListener<[string]>(IPC_CHANNELS.COMMAND.EXECUTE, callback),

  rebuildMenu: (language: Language) =>
    createIpcHandler<boolean>(IPC_CHANNELS.MENU.REBUILD, language),

  executeMainCommand: (commandId: string) =>
    createIpcHandler<boolean>(IPC_CHANNELS.COMMAND.EXECUTE_MAIN, commandId),

  readClipboardImage: () =>
    createIpcHandler<{ base64: string; width: number; height: number } | null>(IPC_CHANNELS.CLIPBOARD.READ_IMAGE),

  // ========== 窗口运行期布局 ==========
  layoutChanged: (payload: { showSidebar?: boolean; showTabBar?: boolean; showStatusBar?: boolean }) =>
    createIpcHandler<boolean>(IPC_CHANNELS.LAYOUT.CHANGED, payload),

  // ========== 文件外部修改检测（P2-10） ==========
  onExternalFileChanged: (callback: (payload: { filePath: string; kind: 'modified' | 'deleted' }) => void) =>
    createListener<[{ filePath: string; kind: 'modified' | 'deleted' }]>(
      IPC_CHANNELS.FILE.EXTERNAL_CHANGED,
      callback,
    ),

  // ========== 跨窗口标签操作 ==========
  onTabMerge: (callback) =>
    createListener<[DetachedTabData]>(IPC_CHANNELS.TAB.MERGE, callback),

  onTabDetached: (callback) =>
    createListener<[DetachedTabData]>(IPC_CHANNELS.TAB.DETACHED, callback),

  onFocusTabForFile: (callback) =>
    createListener<[string]>(IPC_CHANNELS.TAB.FOCUS_FOR_FILE, callback),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type { ElectronAPI }
