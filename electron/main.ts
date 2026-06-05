import { app, BrowserWindow, ipcMain, dialog, Menu, shell, screen, nativeTheme } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import Store from 'electron-store'
import {
  IPCErrorCode,
  FileTreeNode,
  DirectoryEntry,
  WindowState,
  createSuccessResponse,
  createErrorResponse,
  IPC_CHANNELS,
  MENU_EVENTS,
  FILE_TYPES,
  LINE_ENDINGS,
  LineEnding
} from '../electron-protocol'
import { rgPath } from '@vscode/ripgrep'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

function isFileNotFoundError(error: NodeJS.ErrnoException): boolean { return error.code === 'ENOENT' }
function isPermissionError(error: NodeJS.ErrnoException): boolean { return error.code === 'EACCES' || error.code === 'EPERM' }

const store = new Store<{ windowState: WindowState, theme?: 'light' | 'dark' | 'system' }>({
  defaults: { windowState: { width: 1200, height: 800, isMaximized: false }, theme: 'light' }
})

let mainWindow: BrowserWindow | null = null
const windows = new Map<number, BrowserWindow>()
const windowOpenFiles = new Map<number, string[]>() // 跟踪每个窗口打开的文件

function getBackgroundColor(theme: 'light' | 'dark' | 'system'): string {
  const effectiveTheme = theme === 'system'
    ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
    : theme
  return effectiveTheme === 'dark' ? '#2e3440' : '#ffffff'
}

function updateAllWindowsTheme(theme: 'light' | 'dark' | 'system') {
  const backgroundColor = getBackgroundColor(theme)
  nativeTheme.themeSource = theme === 'system' ? 'system' : theme
  
  windows.forEach((win) => {
    win.setBackgroundColor(backgroundColor)
  })
}

function createWindow() {
  const windowState = store.get('windowState')
  const theme = store.get('theme') || 'light'
  const backgroundColor = getBackgroundColor(theme)
  
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 250,
    minHeight: 300,
    webPreferences: { preload: path.join(__dirname, 'preload.mjs'), contextIsolation: true, nodeIntegration: false, webSecurity: false },
    show: false,
    backgroundColor
  })
  windows.set(mainWindow.id, mainWindow)
  windowOpenFiles.set(mainWindow.id, []) // 初始化该窗口的打开文件列表

  mainWindow.on('ready-to-show', () => {
    if (windowState.isMaximized) mainWindow?.maximize()
    mainWindow?.show()
  })

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      store.set('windowState', { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y, isMaximized: mainWindow.isMaximized() })
    }
  })

  mainWindow.on('closed', () => { 
    if (mainWindow) { 
      windows.delete(mainWindow.id) 
      windowOpenFiles.delete(mainWindow.id) // 清理该窗口的文件跟踪
    } 
    mainWindow = null 
  })

  if (VITE_DEV_SERVER_URL) mainWindow.loadURL(VITE_DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: '文件', submenu: [
      { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send(MENU_EVENTS.NEW_FILE) },
      { label: '新建窗口', accelerator: 'CmdOrCtrl+Shift+N', click: () => mainWindow?.webContents.send(MENU_EVENTS.NEW_WINDOW) },
      { label: '打开', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send(MENU_EVENTS.OPEN_FILE) },
      { label: '打开文件夹', click: () => mainWindow?.webContents.send(MENU_EVENTS.OPEN_FOLDER) },
      { type: 'separator' },
      { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send(MENU_EVENTS.SAVE) },
      { label: '另存为', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send(MENU_EVENTS.SAVE_AS) },
      { type: 'separator' },
      { label: '导出', click: () => mainWindow?.webContents.send(MENU_EVENTS.TOOLS_EXPORT) },
      { type: 'separator' },
      { role: 'quit', label: '退出' }
    ]},
    { label: '编辑', submenu: [
      { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send(MENU_EVENTS.EDIT_UNDO) },
      { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: () => mainWindow?.webContents.send(MENU_EVENTS.EDIT_REDO) },
      { type: 'separator' },
      { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' },
      { type: 'separator' },
      { label: '复制为 Markdown', click: () => mainWindow?.webContents.send(MENU_EVENTS.COPY_AS_MARKDOWN) },
      { label: '复制为 HTML', click: () => mainWindow?.webContents.send(MENU_EVENTS.COPY_AS_HTML) },
      { label: '粘贴为纯文本', click: () => mainWindow?.webContents.send(MENU_EVENTS.PASTE_AS_PLAIN) },
      { type: 'separator' },
      { role: 'selectAll', label: '全选' },
      { type: 'separator' },
      { label: '查找', accelerator: 'CmdOrCtrl+F', click: () => mainWindow?.webContents.send(MENU_EVENTS.EDIT_UNDO, { action: 'find' }) }
    ]},
    { label: '段落', submenu: [
      { label: '标题 1', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_HEADING1) },
      { label: '标题 2', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_HEADING2) },
      { label: '标题 3', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_HEADING3) },
      { label: '段落', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_PARAGRAPH) },
      { type: 'separator' },
      { label: '引用', accelerator: 'CmdOrCtrl+Alt+Q', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_QUOTE) },
      { label: '无序列表', accelerator: 'CmdOrCtrl+Alt+U', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_BULLET_LIST) },
      { label: '有序列表', accelerator: 'CmdOrCtrl+Alt+O', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_ORDERED_LIST) },
      { label: '任务列表', accelerator: 'CmdOrCtrl+Alt+X', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_TASK_LIST) },
      { type: 'separator' },
      { label: '代码块', accelerator: 'CmdOrCtrl+Alt+C', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_CODE_BLOCK) },
      { label: '数学公式', accelerator: 'CmdOrCtrl+Alt+M', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_MATH_BLOCK) },
      { label: '分割线', accelerator: 'CmdOrCtrl+Alt+-', click: () => mainWindow?.webContents.send(MENU_EVENTS.PARAGRAPH_HORIZONTAL_RULE) }
    ]},
    { label: '表格', submenu: [
      { label: '插入表格', accelerator: 'CmdOrCtrl+Alt+T', click: () => mainWindow?.webContents.send(MENU_EVENTS.TABLE_INSERT) },
      { type: 'separator' },
      { label: '上方插入行', click: () => mainWindow?.webContents.send(MENU_EVENTS.TABLE_INSERT_ROW_ABOVE) },
      { label: '下方插入行', click: () => mainWindow?.webContents.send(MENU_EVENTS.TABLE_INSERT_ROW_BELOW) },
      { label: '删除行', click: () => mainWindow?.webContents.send(MENU_EVENTS.TABLE_DELETE_ROW) },
      { type: 'separator' },
      { label: '左侧插入列', click: () => mainWindow?.webContents.send(MENU_EVENTS.TABLE_INSERT_COLUMN_LEFT) },
      { label: '右侧插入列', click: () => mainWindow?.webContents.send(MENU_EVENTS.TABLE_INSERT_COLUMN_RIGHT) },
      { label: '删除列', click: () => mainWindow?.webContents.send(MENU_EVENTS.TABLE_DELETE_COLUMN) }
    ]},
    { label: '视图', submenu: [
      { label: 'WYSIWYG 模式', click: () => mainWindow?.webContents.send(MENU_EVENTS.VIEW_MODE, 'wysiwyg') },
      { label: '源码模式', click: () => mainWindow?.webContents.send(MENU_EVENTS.VIEW_MODE, 'source') },
      { label: '分屏模式', click: () => mainWindow?.webContents.send(MENU_EVENTS.VIEW_MODE, 'split') },
      { type: 'separator' },
      { label: '显示/隐藏侧边栏', accelerator: 'CmdOrCtrl+B', click: () => mainWindow?.webContents.send(MENU_EVENTS.TOGGLE_SIDEBAR) },
      { label: '显示/隐藏标签栏', click: () => mainWindow?.webContents.send(MENU_EVENTS.TOGGLE_TAB_BAR) },
      { label: '显示/隐藏状态栏', click: () => mainWindow?.webContents.send(MENU_EVENTS.TOGGLE_STATUS_BAR) },
      { type: 'separator' },
      { label: '悬浮便签模式', accelerator: 'CmdOrCtrl+Shift+F', click: () => {
        if (mainWindow) {
          const currentSize = mainWindow.getSize()
          const isSmall = currentSize[0] <= 400 && currentSize[1] <= 500
          if (isSmall) { mainWindow.setSize(1200, 800); mainWindow.setAlwaysOnTop(false) }
          else { mainWindow.setSize(350, 450); mainWindow.setAlwaysOnTop(true) }
          mainWindow.webContents.send(MENU_EVENTS.TOGGLE_STICKY_NOTE)
        }
      }},
      { label: '沉浸式写作模式', accelerator: 'CmdOrCtrl+Shift+Enter', click: () => mainWindow?.webContents.send(MENU_EVENTS.TOGGLE_IMMERSIVE) },
      { type: 'separator' },
      { label: '暗色模式', accelerator: 'CmdOrCtrl+Shift+D', click: () => mainWindow?.webContents.send(MENU_EVENTS.TOGGLE_THEME) },
      { type: 'separator' },
      { label: '放大', accelerator: 'CmdOrCtrl+Plus', click: () => mainWindow?.webContents.send(MENU_EVENTS.ZOOM_IN) },
      { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => mainWindow?.webContents.send(MENU_EVENTS.ZOOM_OUT) },
      { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.send(MENU_EVENTS.ZOOM_RESET) },
      { type: 'separator' },
      { label: '开发者工具', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.isDevToolsOpened() ? mainWindow.webContents.closeDevTools() : mainWindow?.webContents.openDevTools() },
      { type: 'separator' },
      { label: '全屏', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
      { label: '打印', accelerator: 'CmdOrCtrl+P', click: () => mainWindow?.webContents.print() }
    ]},
    { label: '工具', submenu: [
      { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send(MENU_EVENTS.TOOLS_PREFERENCES) },
      { label: '快捷键列表', accelerator: 'CmdOrCtrl+Shift+K', click: () => mainWindow?.webContents.send(MENU_EVENTS.HELP_SHORTCUTS) },
      { type: 'separator' },
      { label: '截图', click: () => mainWindow?.webContents.send(MENU_EVENTS.CAPTURE_SCREEN) }
    ]},
    { label: '帮助', submenu: [
      { label: '快捷键列表', accelerator: 'CmdOrCtrl+Shift+K', click: () => mainWindow?.webContents.send(MENU_EVENTS.HELP_SHORTCUTS) },
      { type: 'separator' },
      { label: '关于', click: () => dialog.showMessageBox({ type: 'info', title: '关于 顾念笔记', message: '顾念笔记 (Alhagi) v1.0.0', detail: '基于 Milkdown 的现代化 Markdown 编辑器' }) }
    ]}
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle(IPC_CHANNELS.FILE.OPEN, async () => {
  if (!mainWindow) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')
  try {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }, { name: '所有文件', extensions: ['*'] }] })
    if (result.canceled || result.filePaths.length === 0) return createSuccessResponse(null)
    const filePath = result.filePaths[0]
    const content = await fs.readFile(filePath, 'utf-8')
    return createSuccessResponse({ filePath, content })
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_READ_ERROR, `Failed to read file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.SAVE, async (_, { filePath, content, lineEnding }) => {
  try {
    let finalContent = content
    if (lineEnding && lineEnding in LINE_ENDINGS) {
      const targetEnding = LINE_ENDINGS[lineEnding as LineEnding]
      finalContent = content.replace(/\r\n/g, '\n').replace(/\n/g, targetEnding)
    }
    await fs.writeFile(filePath, finalContent, 'utf-8')
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_SAVE_ERROR, `Failed to save file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.SAVE_AS, async (_, { content, defaultPath, lineEnding }) => {
  if (!mainWindow) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')
  try {
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultPath || 'untitled.md', filters: [{ name: 'Markdown', extensions: ['md'] }, { name: '所有文件', extensions: ['*'] }] })
    if (result.canceled || !result.filePath) return createSuccessResponse(null)
    let finalContent = content
    if (lineEnding && lineEnding in LINE_ENDINGS) {
      const targetEnding = LINE_ENDINGS[lineEnding as LineEnding]
      finalContent = content.replace(/\r\n/g, '\n').replace(/\n/g, targetEnding)
    }
    await fs.writeFile(result.filePath, finalContent, 'utf-8')
    return createSuccessResponse(result.filePath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_SAVE_ERROR, `Failed to save file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.SAVE_BINARY, async (_, { filePath, content }) => {
  try {
    console.log('[Main] Saving binary file:', filePath)
    console.log('[Main] Content length:', content?.length || 0)
    console.log('[Main] Content preview:', content?.substring(0, 50) || 'empty')
    
    if (!filePath || typeof filePath !== 'string') return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
    
    // 确保目录存在
    const dirPath = path.dirname(filePath)
    console.log('[Main] Directory path:', dirPath)
    try {
      await fs.access(dirPath)
      console.log('[Main] Directory exists')
    } catch {
      console.log('[Main] Creating directory')
      await fs.mkdir(dirPath, { recursive: true })
    }
    
    // 内容应该是 base64 编码的二进制数据
    console.log('[Main] Decoding base64 to buffer...')
    const buffer = Buffer.from(content, 'base64')
    console.log('[Main] Buffer size after decode:', buffer.length)
    console.log('[Main] Buffer preview:', buffer.toString('hex').substring(0, 50))
    
    await fs.writeFile(filePath, buffer)
    console.log('[Main] File written successfully')
    
    // 验证文件已保存
    const stats = await fs.stat(filePath)
    console.log('[Main] File saved, size:', stats.size)
    
    // 再次读取验证
    const verifyBuffer = await fs.readFile(filePath)
    console.log('[Main] Verification read size:', verifyBuffer.length)
    console.log('[Main] Verification preview:', verifyBuffer.toString('hex').substring(0, 50))
    
    return createSuccessResponse(true)
  } catch (err) {
    console.error('[Main] Error saving file:', err)
    const error = err as NodeJS.ErrnoException
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_SAVE_ERROR, `Failed to save file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.READ, async (_, filePath: string) => {
  try {
    if (!filePath || typeof filePath !== 'string') return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
    const content = await fs.readFile(filePath, 'utf-8')
    return createSuccessResponse(content)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_READ_ERROR, `Failed to read file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.READ_BINARY, async (_, filePath: string) => {
  try {
    if (!filePath || typeof filePath !== 'string') return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
    const buffer = await fs.readFile(filePath)
    const base64 = buffer.toString('base64')
    const ext = filePath.split('.').pop()?.toLowerCase()
    let mimeType = 'application/octet-stream'
    if (ext === 'png') mimeType = 'image/png'
    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
    else if (ext === 'gif') mimeType = 'image/gif'
    else if (ext === 'svg') mimeType = 'image/svg+xml'
    else if (ext === 'webp') mimeType = 'image/webp'
    const dataUrl = `data:${mimeType};base64,${base64}`
    return createSuccessResponse(dataUrl)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_READ_ERROR, `Failed to read file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.OPEN_FOLDER, async () => {
  if (!mainWindow) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')
  try {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return createSuccessResponse(null)
    const folderPath = result.filePaths[0]
    const tree = await buildFileTree(folderPath, 10)
    return createSuccessResponse({ path: folderPath, tree })
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.DIRECTORY_READ_ERROR, `Failed to read folder: ${error.message}`)
  }
})

async function buildFileTree(dirPath: string, maxDepth: number, currentDepth = 0): Promise<FileTreeNode[]> {
  if (currentDepth >= maxDepth) return []
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const result: FileTreeNode[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const children = await buildFileTree(fullPath, maxDepth, currentDepth + 1)
        result.push({ name: entry.name, path: fullPath, type: FILE_TYPES.DIRECTORY, children, expanded: false })
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
        result.push({ name: entry.name, path: fullPath, type: FILE_TYPES.FILE })
      }
    }
    return result
  } catch (error) {
    console.error('Failed to read directory:', error)
    return []
  }
}

ipcMain.handle(IPC_CHANNELS.FILE.READ_DIRECTORY, async (_, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const result: DirectoryEntry[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry.name)
      const stats = await fs.stat(fullPath)
      result.push({ name: entry.name, path: fullPath, isDirectory: entry.isDirectory(), isFile: entry.isFile(), size: stats.size, lastModified: stats.mtimeMs })
    }
    return createSuccessResponse(result)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.DIRECTORY_READ_ERROR, `Failed to read directory: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.CREATE, async (_, { dirPath, fileName, type }) => {
  try {
    const newPath = path.join(dirPath, fileName)
    if (type === FILE_TYPES.DIRECTORY) await fs.mkdir(newPath, { recursive: true })
    else await fs.writeFile(newPath, '', 'utf-8')
    return createSuccessResponse(newPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.FILE_CREATE_ERROR, `Failed to create: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.DELETE, async (_, filePath: string) => {
  try {
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) await fs.rm(filePath, { recursive: true })
    else await fs.unlink(filePath)
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_DELETE_ERROR, `Failed to delete: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.DIALOG.SELECT_DIRECTORY, async () => {
  if (!mainWindow) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')
  try {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return createSuccessResponse(null)
    return createSuccessResponse(result.filePaths[0])
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to select directory: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.RENAME, async (_, { oldPath, newName }) => {
  try {
    const dir = path.dirname(oldPath)
    const newPath = path.join(dir, newName)
    await fs.rename(oldPath, newPath)
    return createSuccessResponse(newPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_RENAME_ERROR, `Failed to rename: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.MOVE, async (_, { sourcePath, targetDir }) => {
  try {
    const fileName = path.basename(sourcePath)
    const targetPath = path.join(targetDir, fileName)
    try { await fs.access(targetPath); return createErrorResponse(IPCErrorCode.FILE_MOVE_ERROR, `File already exists: ${targetPath}`) } catch { /* File doesn't exist, safe to proceed */ }
    try { await fs.rename(sourcePath, targetPath) } catch { const content = await fs.readFile(sourcePath); await fs.writeFile(targetPath, content); await fs.unlink(sourcePath) }
    return createSuccessResponse(targetPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_MOVE_ERROR, `Failed to move file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.COPY, async (_, { sourcePath, targetDir }) => {
  try {
    const fileName = path.basename(sourcePath)
    const targetPath = path.join(targetDir, fileName)
    try { await fs.access(targetPath); return createErrorResponse(IPCErrorCode.FILE_COPY_ERROR, `File already exists: ${targetPath}`) } catch { /* File doesn't exist, safe to proceed */ }
    const content = await fs.readFile(sourcePath)
    await fs.writeFile(targetPath, content)
    return createSuccessResponse(targetPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.FILE_COPY_ERROR, `Failed to copy file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.SEARCH_IN_DIRECTORY, async (_, { dirPath, query, options }) => {
  if (!query.trim()) return createSuccessResponse([])
  return new Promise((resolve) => {
    const args = ['--json']
    if (!options?.caseSensitive) args.push('-i')
    if (options?.wholeWord) args.push('-w')
    args.push('--glob', '*.md', '--glob', '*.markdown', '--glob', '*.txt')
    const excludePatterns = options?.excludePatterns || ['node_modules', '.git', 'dist', '__pycache__']
    excludePatterns.forEach(pattern => args.push('--glob', `!${pattern}`))
    const searchPattern = options?.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    args.push(searchPattern, dirPath)
    let stdout = ''
    const rgProcess = spawn(rgPath, args)
    rgProcess.stdout.on('data', (data) => { stdout += data.toString() })
    rgProcess.on('error', () => resolve(createSuccessResponse([])))
    rgProcess.on('close', () => {
      const results: Array<{ filePath: string; lineNumber: number; lineContent: string; matchStart: number; matchEnd: number }> = []
      stdout.trim().split('\n').forEach(line => {
        if (!line.trim()) return
        try {
          const json = JSON.parse(line)
          if (json.type === 'match') {
            const filePath = json.data.path.text
            const lineNumber = json.data.line_number
            const lineContent = json.data.lines.text.replace(/\r?\n$/, '')
            json.data.submatches.forEach((submatch: { start: number; end: number }) => {
              results.push({ filePath, lineNumber, lineContent, matchStart: submatch.start, matchEnd: submatch.end })
            })
          }
        } catch { /* Skip invalid JSON */ }
      })
      resolve(createSuccessResponse(results))
    })
  })
})

ipcMain.handle(IPC_CHANNELS.WINDOW.MINIMIZE, () => { mainWindow?.minimize(); return createSuccessResponse(undefined) })
ipcMain.handle(IPC_CHANNELS.WINDOW.MAXIMIZE, () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
  return createSuccessResponse(undefined)
})
ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE, () => { mainWindow?.close(); return createSuccessResponse(undefined) })
ipcMain.handle(IPC_CHANNELS.WINDOW.SET_ALWAYS_ON_TOP, (_, flag: boolean) => { mainWindow?.setAlwaysOnTop(flag); return createSuccessResponse(undefined) })

ipcMain.handle(IPC_CHANNELS.WINDOW.OPEN_NEW_WINDOW, async (_, options?) => {
  try {
    const bounds = options?.bounds || { width: 1200, height: 800 }
    const theme = store.get('theme') || 'light'
    const backgroundColor = getBackgroundColor(theme)
    
    const newWindow = new BrowserWindow({
      width: bounds.width || 1200,
      height: bounds.height || 800,
      x: bounds.x,
      y: bounds.y,
      minWidth: 250,
      minHeight: 300,
      webPreferences: { preload: path.join(__dirname, 'preload.mjs'), contextIsolation: true, nodeIntegration: false },
      show: false,
      backgroundColor
    })
    windows.set(newWindow.id, newWindow)
    windowOpenFiles.set(newWindow.id, []) // 初始化该窗口的打开文件列表

    newWindow.on('closed', () => { 
      windows.delete(newWindow.id) 
      windowOpenFiles.delete(newWindow.id) // 清理该窗口的文件跟踪
    })

    newWindow.on('ready-to-show', () => newWindow.show())
    
    const filePath = options?.filePath
    if (VITE_DEV_SERVER_URL) {
      newWindow.loadURL(filePath ? `${VITE_DEV_SERVER_URL}?file=${encodeURIComponent(filePath)}` : VITE_DEV_SERVER_URL)
    } else {
      newWindow.loadFile(filePath ? `${path.join(RENDERER_DIST, 'index.html')}?file=${encodeURIComponent(filePath)}` : path.join(RENDERER_DIST, 'index.html'))
    }
    
    if (options?.tabData) {
      newWindow.webContents.once('did-finish-load', () => {
        newWindow.webContents.send('tab:detached', options.tabData)
      })
    }
    
    return createSuccessResponse(newWindow.id)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to open new window: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.MERGE_TAB, async (_, { tabData, targetWindowId }) => {
  try {
    const targetWindow = windows.get(targetWindowId)
    if (!targetWindow || targetWindow.isDestroyed()) {
      windows.delete(targetWindowId)
      return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Target window not found or destroyed')
    }
    targetWindow.webContents.send('tab:merge', tabData)
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to merge tab: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.GET_WINDOW_ID, (event) => { const window = BrowserWindow.fromWebContents(event.sender); return createSuccessResponse(window?.id || null) })
ipcMain.handle(IPC_CHANNELS.WINDOW.LIST_WINDOWS, () => {
  const result: Array<{ id: number; title: string; bounds: { x: number; y: number; width: number; height: number } }> = []
  for (const [id, win] of windows) {
    // 防御性检查：跳过已销毁的窗口（防止 Object has been destroyed）
    if (!win || win.isDestroyed()) {
      windows.delete(id)
      continue
    }
    try {
      const bounds = win.getBounds()
      result.push({ id, title: win.getTitle(), bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } })
    } catch {
      // 窗口可能在检查后被销毁，静默跳过
      windows.delete(id)
    }
  }
  return createSuccessResponse(result)
})

ipcMain.handle(IPC_CHANNELS.WINDOW.GET_CURSOR_SCREEN_POINT, (event) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not found')
    }
    
    const bounds = window.getBounds()
    return createSuccessResponse({
      x: bounds.x,
      y: bounds.y
    })
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to get cursor point: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.OPEN_DEV_TOOLS, () => {
  mainWindow?.webContents.openDevTools()
  return createSuccessResponse(true)
})

ipcMain.handle(IPC_CHANNELS.WINDOW.GET_SCREEN_DISPLAY, () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { bounds } = primaryDisplay
    
    return createSuccessResponse({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    })
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to get screen display: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.SHOW_IN_FOLDER, async (_, filePath: string) => {
  try {
    if (!filePath || typeof filePath !== 'string') return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
    shell.showItemInFolder(filePath)
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to show in folder: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.GET_DOCUMENTS_DIRECTORY, async () => {
  try {
    const documentsPath = app.getPath('documents')
    return createSuccessResponse(documentsPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to get documents directory: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.ENSURE_DIRECTORY, async (_, dirPath: string) => {
  try {
    if (!dirPath || typeof dirPath !== 'string') return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid directory path')
    await fs.mkdir(dirPath, { recursive: true })
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isPermissionError(error)) return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    return createErrorResponse(IPCErrorCode.DIRECTORY_CREATE_ERROR, `Failed to create directory: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.FOCUS_WINDOW, (_, windowId: number, filePath?: string) => {
  try {
    const win = windows.get(windowId)
    if (!win || win.isDestroyed()) {
      return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not found')
    }
    if (win.isMinimized()) {
      win.restore()
    }
    win.focus()
    
    // 如果提供了 filePath，发送消息到该窗口让它切换到对应标签页
    if (filePath) {
      win.webContents.send('focus-tab-for-file', filePath)
    }
    
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to focus window: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.CHECK_FILE_OPEN, (event, filePath: string) => {
  try {
    let targetWindowId: number | null = null
    const currentWindow = BrowserWindow.fromWebContents(event.sender)
    const currentWindowId = currentWindow?.id
    
    // 遍历所有窗口，查找该文件是否已打开（排除当前窗口）
    for (const [windowId, openFiles] of windowOpenFiles) {
      if (windowId !== currentWindowId && openFiles.includes(filePath)) {
        targetWindowId = windowId
        break
      }
    }
    return createSuccessResponse({ windowId: targetWindowId })
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to check file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.UPDATE_OPENED_FILES, (event, filePaths: string[]) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not found')
    }
    windowOpenFiles.set(window.id, filePaths)
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to update opened files: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.SET_ZOOM, (event, zoomLevel: number) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not found')
    }
    const zoomFactor = zoomLevel / 100
    window.webContents.setZoomFactor(zoomFactor)
    return createSuccessResponse(undefined)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to set zoom: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.SET_THEME, (_, theme: 'light' | 'dark' | 'system') => {
  store.set('theme', theme)
  updateAllWindowsTheme(theme)
  return createSuccessResponse(undefined)
})

app.whenReady().then(() => { createMenu(); createWindow() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })
