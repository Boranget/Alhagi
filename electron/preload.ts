import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { 
  IPCResponse,
  ElectronAPI,
  IPC_CHANNELS,
  MENU_EVENTS,
  FILE_TYPES,
  DetachedTabData
} from '../electron-protocol'

export type { IPCResponse, DetachedTabData } from '../electron-protocol'

function createIpcHandler<T>(
  channel: string,
  ...args: unknown[]
): Promise<IPCResponse<T>> {
  return ipcRenderer.invoke(channel, ...args)
}

function createMenuListener(
  channel: string,
  callback: (...args: unknown[]) => void
): () => void {
  const handler = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: ElectronAPI = {
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
  
  onDragStart: (callback: (tabId: string) => void) => 
    createMenuListener(IPC_CHANNELS.WINDOW.DRAG_START, callback),
  
  onDragEnd: (callback: () => void) => 
    createMenuListener(IPC_CHANNELS.WINDOW.DRAG_END, callback),
  
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
  
  onNewFile: (callback) => 
    createMenuListener(MENU_EVENTS.NEW_FILE, callback),
  
  onNewWindow: (callback) => 
    createMenuListener(MENU_EVENTS.NEW_WINDOW, callback),
  
  onOpenFile: (callback) => 
    createMenuListener(MENU_EVENTS.OPEN_FILE, callback),
  
  onOpenFolder: (callback) => 
    createMenuListener(MENU_EVENTS.OPEN_FOLDER, callback),
  
  onSave: (callback) => 
    createMenuListener(MENU_EVENTS.SAVE, callback),
  
  onSaveAs: (callback) => 
    createMenuListener(MENU_EVENTS.SAVE_AS, callback),
  
  onViewMode: (callback) => 
    createMenuListener(MENU_EVENTS.VIEW_MODE, callback),
  
  onCopyAsMarkdown: (callback) => 
    createMenuListener(MENU_EVENTS.COPY_AS_MARKDOWN, callback),
  
  onCopyAsHtml: (callback) => 
    createMenuListener(MENU_EVENTS.COPY_AS_HTML, callback),
  
  onPasteAsPlain: (callback) => 
    createMenuListener(MENU_EVENTS.PASTE_AS_PLAIN, callback),
  
  onCaptureScreen: (callback) => 
    createMenuListener(MENU_EVENTS.CAPTURE_SCREEN, callback),
  
  onTabMerge: (callback) => 
    createMenuListener('tab:merge', callback),
  
  onTabDetached: (callback) =>
    createMenuListener('tab:detached', callback),
  onFocusTabForFile: (callback) =>
    createMenuListener('focus-tab-for-file', callback),
  
  onToggleStickyNoteMode: (callback) => 
    createMenuListener(MENU_EVENTS.TOGGLE_STICKY_NOTE, callback),
  
  onToggleImmersiveMode: (callback) => 
    createMenuListener(MENU_EVENTS.TOGGLE_IMMERSIVE, callback),
  
onToggleSidebar: (callback) => 
    createMenuListener(MENU_EVENTS.TOGGLE_SIDEBAR, callback),
  
  onToggleTabBar: (callback) => 
    createMenuListener(MENU_EVENTS.TOGGLE_TAB_BAR, callback),
  
  onToggleStatusBar: (callback) => 
    createMenuListener(MENU_EVENTS.TOGGLE_STATUS_BAR, callback),
  
  onToggleTheme: (callback) => 
    createMenuListener(MENU_EVENTS.TOGGLE_THEME, callback),
  
  onOpenSettings: (callback) =>
    createMenuListener(MENU_EVENTS.OPEN_SETTINGS, callback),
  
  onEditUndo: (callback) => {
    const handler = (_event: IpcRendererEvent) => {
      callback()
    }
    ipcRenderer.on(MENU_EVENTS.EDIT_UNDO, handler)
    return () => {
      ipcRenderer.removeListener(MENU_EVENTS.EDIT_UNDO, handler)
    }
  },
  
  onEditRedo: (callback) => {
    const handler = (_event: IpcRendererEvent) => {
      callback()
    }
    ipcRenderer.on(MENU_EVENTS.EDIT_REDO, handler)
    return () => {
      ipcRenderer.removeListener(MENU_EVENTS.EDIT_REDO, handler)
    }
  },

  // 格式菜单事件
  onFormatBold: (callback) => createMenuListener(MENU_EVENTS.FORMAT_BOLD, callback),
  onFormatItalic: (callback) => createMenuListener(MENU_EVENTS.FORMAT_ITALIC, callback),
  onFormatStrikethrough: (callback) => createMenuListener(MENU_EVENTS.FORMAT_STRIKETHROUGH, callback),
  onFormatCode: (callback) => createMenuListener(MENU_EVENTS.FORMAT_CODE, callback),
  onFormatLink: (callback) => createMenuListener(MENU_EVENTS.FORMAT_LINK, callback),
  onFormatImage: (callback) => createMenuListener(MENU_EVENTS.FORMAT_IMAGE, callback),
  onFormatHighlight: (callback) => createMenuListener(MENU_EVENTS.FORMAT_HIGHLIGHT, callback),

  // 段落菜单事件
  onParagraphHeading1: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_HEADING1, callback),
  onParagraphHeading2: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_HEADING2, callback),
  onParagraphHeading3: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_HEADING3, callback),
  onParagraphParagraph: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_PARAGRAPH, callback),
  onParagraphQuote: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_QUOTE, callback),
  onParagraphBulletList: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_BULLET_LIST, callback),
  onParagraphOrderedList: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_ORDERED_LIST, callback),
  onParagraphTaskList: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_TASK_LIST, callback),
  onParagraphCodeBlock: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_CODE_BLOCK, callback),
  onParagraphMathBlock: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_MATH_BLOCK, callback),
  onParagraphHorizontalRule: (callback) => createMenuListener(MENU_EVENTS.PARAGRAPH_HORIZONTAL_RULE, callback),

  // 表格菜单事件
  onTableInsert: (callback) => createMenuListener(MENU_EVENTS.TABLE_INSERT, callback),
  onTableInsertRowAbove: (callback) => createMenuListener(MENU_EVENTS.TABLE_INSERT_ROW_ABOVE, callback),
  onTableInsertRowBelow: (callback) => createMenuListener(MENU_EVENTS.TABLE_INSERT_ROW_BELOW, callback),
  onTableInsertColumnLeft: (callback) => createMenuListener(MENU_EVENTS.TABLE_INSERT_COLUMN_LEFT, callback),
  onTableInsertColumnRight: (callback) => createMenuListener(MENU_EVENTS.TABLE_INSERT_COLUMN_RIGHT, callback),
  onTableDeleteRow: (callback) => createMenuListener(MENU_EVENTS.TABLE_DELETE_ROW, callback),
  onTableDeleteColumn: (callback) => createMenuListener(MENU_EVENTS.TABLE_DELETE_COLUMN, callback),

  // 导航菜单事件
  onNavigationQuickOpen: (callback) => createMenuListener(MENU_EVENTS.NAVIGATION_QUICK_OPEN, callback),
  onNavigationGotoLine: (callback) => createMenuListener(MENU_EVENTS.NAVIGATION_GOTO_LINE, callback),

  // 工具菜单事件
  onToolsPreferences: (callback) => createMenuListener(MENU_EVENTS.TOOLS_PREFERENCES, callback),
  onToolsExport: (callback) => createMenuListener(MENU_EVENTS.TOOLS_EXPORT, callback),

  // 帮助菜单事件
  onHelpShortcuts: (callback) => createMenuListener(MENU_EVENTS.HELP_SHORTCUTS, callback)
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type { ElectronAPI }
