import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
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
  LineEnding,
  DetachedTabData
} from '../electron-protocol'
import { rgPath } from '@vscode/ripgrep'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

function isFileNotFoundError(error: NodeJS.ErrnoException): boolean {
  return error.code === 'ENOENT'
}

function isPermissionError(error: NodeJS.ErrnoException): boolean {
  return error.code === 'EACCES' || error.code === 'EPERM'
}

const store = new Store<{ windowState: WindowState }>({
  defaults: {
    windowState: {
      width: 1200,
      height: 800,
      isMaximized: false
    }
  }
})

let mainWindow: BrowserWindow | null = null
const windows = new Map<number, BrowserWindow>()

function createWindow() {
  const windowState = store.get('windowState')

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 250,
    minHeight: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    backgroundColor: '#ffffff'
  })

  windows.set(mainWindow.id, mainWindow)

  mainWindow.on('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow?.maximize()
    }
    mainWindow?.show()
  })

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      store.set('windowState', {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: mainWindow.isMaximized()
      })
    }
  })

  mainWindow.on('closed', () => {
    windows.delete(mainWindow!.id)
    mainWindow = null
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send(MENU_EVENTS.NEW_FILE) },
        { label: '打开', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send(MENU_EVENTS.OPEN_FILE) },
        { label: '打开文件夹', click: () => mainWindow?.webContents.send(MENU_EVENTS.OPEN_FOLDER) },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send(MENU_EVENTS.SAVE) },
        { label: '另存为', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send(MENU_EVENTS.SAVE_AS) },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { label: '复制为 Markdown', click: () => mainWindow?.webContents.send(MENU_EVENTS.COPY_AS_MARKDOWN) },
        { label: '复制为 HTML', click: () => mainWindow?.webContents.send(MENU_EVENTS.COPY_AS_HTML) },
        { label: '粘贴为纯文本', click: () => mainWindow?.webContents.send(MENU_EVENTS.PASTE_AS_PLAIN) },
        { type: 'separator' },
        { label: '截图', click: () => mainWindow?.webContents.send(MENU_EVENTS.CAPTURE_SCREEN) },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: 'WYSIWYG 模式', click: () => mainWindow?.webContents.send(MENU_EVENTS.VIEW_MODE, 'wysiwyg') },
        { label: '源码模式', click: () => mainWindow?.webContents.send(MENU_EVENTS.VIEW_MODE, 'source') },
        { label: '分屏模式', click: () => mainWindow?.webContents.send(MENU_EVENTS.VIEW_MODE, 'split') },
        { type: 'separator' },
        { label: '悬浮便签模式', accelerator: 'CmdOrCtrl+Shift+F', click: () => {
            if (mainWindow) {
              const currentSize = mainWindow.getSize()
              const isSmall = currentSize[0] <= 400 && currentSize[1] <= 500

              if (isSmall) {
                mainWindow.setSize(1200, 800)
                mainWindow.setAlwaysOnTop(false)
              } else {
                mainWindow.setSize(350, 450)
                mainWindow.setAlwaysOnTop(true)
              }
              // 同时通知渲染进程切换 UI
              mainWindow.webContents.send(MENU_EVENTS.TOGGLE_STICKY_NOTE)
            }
          }},
        { label: '沉浸式写作模式', accelerator: 'CmdOrCtrl+Shift+Enter', click: () => {
            mainWindow?.webContents.send(MENU_EVENTS.TOGGLE_IMMERSIVE)
          }},
        { type: 'separator' },
        { label: '开发者工具', accelerator: 'CmdOrCtrl+Shift+I', click: () => {
            if (mainWindow?.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools()
            } else {
              mainWindow?.webContents.openDevTools()
            }
          }},
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: '打印', accelerator: 'CmdOrCtrl+P', click: () => mainWindow?.webContents.print() }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于', click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于 顾念笔记',
              message: '顾念笔记 (Alhagi) v1.0.0',
              detail: '基于 Milkdown 的现代化 Markdown 编辑器'
            })
          }}
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

ipcMain.handle(IPC_CHANNELS.FILE.OPEN, async () => {
  if (!mainWindow) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return createSuccessResponse(null)
    }

    const filePath = result.filePaths[0]
    const content = await fs.readFile(filePath, 'utf-8')
    return createSuccessResponse({ filePath, content })
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) {
      return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    }
    if (isPermissionError(error)) {
      return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    }
    return createErrorResponse(IPCErrorCode.FILE_READ_ERROR, `Failed to read file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.SAVE, async (_, { filePath, content, lineEnding }) => {
  try {
    let finalContent = content
    if (lineEnding && lineEnding in LINE_ENDINGS) {
      const targetEnding = LINE_ENDINGS[lineEnding as LineEnding]
      finalContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\n/g, targetEnding)
    }
    await fs.writeFile(filePath, finalContent, 'utf-8')
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) {
      return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    }
    if (isPermissionError(error)) {
      return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    }
    return createErrorResponse(IPCErrorCode.FILE_SAVE_ERROR, `Failed to save file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.SAVE_AS, async (_, { content, defaultPath, lineEnding }) => {
  if (!mainWindow) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')

  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath || 'untitled.md',
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return createSuccessResponse(null)
    }

    let finalContent = content
    if (lineEnding && lineEnding in LINE_ENDINGS) {
      const targetEnding = LINE_ENDINGS[lineEnding as LineEnding]
      finalContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\n/g, targetEnding)
    }
    await fs.writeFile(result.filePath, finalContent, 'utf-8')
    return createSuccessResponse(result.filePath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isPermissionError(error)) {
      return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    }
    return createErrorResponse(IPCErrorCode.FILE_SAVE_ERROR, `Failed to save file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.READ, async (_, filePath: string) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
    }
    const content = await fs.readFile(filePath, 'utf-8')
    return createSuccessResponse(content)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) {
      return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    }
    if (isPermissionError(error)) {
      return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    }
    return createErrorResponse(IPCErrorCode.FILE_READ_ERROR, `Failed to read file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.OPEN_FOLDER, async () => {
  if (!mainWindow) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return createSuccessResponse(null)
    }

    const folderPath = result.filePaths[0]
    const tree = await buildFileTree(folderPath, 3)
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
        result.push({
          name: entry.name,
          path: fullPath,
          type: FILE_TYPES.DIRECTORY,
          children,
          expanded: false
        })
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
        result.push({
          name: entry.name,
          path: fullPath,
          type: FILE_TYPES.FILE
        })
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

      result.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        size: stats.size,
        lastModified: stats.mtimeMs
      })
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

    if (type === FILE_TYPES.DIRECTORY) {
      await fs.mkdir(newPath, { recursive: true })
    } else {
      await fs.writeFile(newPath, '', 'utf-8')
    }

    return createSuccessResponse(newPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.FILE_CREATE_ERROR, `Failed to create: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.DELETE, async (_, filePath: string) => {
  try {
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) {
      await fs.rm(filePath, { recursive: true })
    } else {
      await fs.unlink(filePath)
    }
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) {
      return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    }
    if (isPermissionError(error)) {
      return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    }
    return createErrorResponse(IPCErrorCode.FILE_DELETE_ERROR, `Failed to delete: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.DIALOG.SELECT_DIRECTORY, async () => {
  if (!mainWindow) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return createSuccessResponse(null)
    }

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
    if (isFileNotFoundError(error)) {
      return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    }
    if (isPermissionError(error)) {
      return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    }
    return createErrorResponse(IPCErrorCode.FILE_RENAME_ERROR, `Failed to rename: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.MOVE, async (_, { sourcePath, targetDir }) => {
  try {
    const fileName = path.basename(sourcePath)
    const targetPath = path.join(targetDir, fileName)

    try {
      await fs.access(targetPath)
      return createErrorResponse(IPCErrorCode.FILE_MOVE_ERROR, `File already exists: ${targetPath}`)
    } catch {
      // File doesn't exist, safe to proceed
    }

    try {
      await fs.rename(sourcePath, targetPath)
    } catch (renameErr) {
      const content = await fs.readFile(sourcePath)
      await fs.writeFile(targetPath, content)
      await fs.unlink(sourcePath)
    }

    return createSuccessResponse(targetPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) {
      return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    }
    if (isPermissionError(error)) {
      return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    }
    return createErrorResponse(IPCErrorCode.FILE_MOVE_ERROR, `Failed to move file: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.FILE.COPY, async (_, { sourcePath, targetDir }) => {
  try {
    const fileName = path.basename(sourcePath)
    const targetPath = path.join(targetDir, fileName)

    try {
      await fs.access(targetPath)
      return createErrorResponse(IPCErrorCode.FILE_COPY_ERROR, `File already exists: ${targetPath}`)
    } catch {
      // File doesn't exist, safe to proceed
    }

    const content = await fs.readFile(sourcePath)
    await fs.writeFile(targetPath, content)

    return createSuccessResponse(targetPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (isFileNotFoundError(error)) {
      return createErrorResponse(IPCErrorCode.FILE_NOT_FOUND, `File not found: ${error.message}`)
    }
    if (isPermissionError(error)) {
      return createErrorResponse(IPCErrorCode.PERMISSION_DENIED, `Permission denied: ${error.message}`)
    }
    return createErrorResponse(IPCErrorCode.FILE_COPY_ERROR, `Failed to copy file: ${error.message}`)
  }
})

// Ripgrep-based search implementation
async function searchWithRipgrep(
  dirPath: string,
  query: string,
  options: {
    includePatterns?: string[]
    excludePatterns?: string[]
    caseSensitive?: boolean
    wholeWord?: boolean
    useRegex?: boolean
  } = {}
): Promise<Array<{ filePath: string; lineNumber: number; lineContent: string; matchStart: number; matchEnd: number }>> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['--json']

    if (!options.caseSensitive) {
      args.push('-i')
    }

    if (options.wholeWord) {
      args.push('-w')
    }

    // Add glob patterns for markdown/text files
    args.push('--glob', '*.md')
    args.push('--glob', '*.markdown')
    args.push('--glob', '*.txt')

    // Add exclude patterns
    const excludePatterns = options.excludePatterns || ['node_modules', '.git', 'dist', '__pycache__']
    for (const pattern of excludePatterns) {
      args.push('--glob', `!${pattern}`)
    }

    // Build search pattern
    let searchPattern = query
    if (!options.useRegex) {
      // Escape regex special characters
      searchPattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    args.push(searchPattern)
    args.push(dirPath)

    let stdout = ''
    let stderr = ''

    const rgProcess = spawn(rgPath, args)

    rgProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    rgProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    rgProcess.on('error', (error) => {
      console.error('Ripgrep error:', error)
      reject(error)
    })

    rgProcess.on('close', (code) => {
      if (code !== 0 && code !== 1) { // 0 = matches found, 1 = no matches
        console.error('Ripgrep stderr:', stderr)
        return resolve([])
      }

      const results: Array<{ filePath: string; lineNumber: number; lineContent: string; matchStart: number; matchEnd: number }> = []

      try {
        const lines = stdout.trim().split('\n')

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const json = JSON.parse(line)

            if (json.type === 'match') {
              const filePath = json.data.path.text
              const lineNumber = json.data.line_number
              const lineContent = json.data.lines.text.replace(/\r?\n$/, '')

              for (const submatch of json.data.submatches) {
                results.push({
                  filePath,
                  lineNumber,
                  lineContent,
                  matchStart: submatch.start,
                  matchEnd: submatch.end
                })
              }
            }
          } catch (jsonError) {
            // Skip invalid JSON lines
            continue
          }
        }

        resolve(results)
      } catch (parseError) {
        console.error('Error parsing ripgrep output:', parseError)
        resolve([])
      }
    })
  })
}

// Fallback to filesystem-based search if ripgrep fails
async function searchFallback(
  dirPath: string,
  query: string,
  options: {
    includePatterns?: string[]
    excludePatterns?: string[]
    caseSensitive?: boolean
    wholeWord?: boolean
    useRegex?: boolean
  } = {}
): Promise<Array<{ filePath: string; lineNumber: number; lineContent: string; matchStart: number; matchEnd: number }>> {
  const results: Array<{ filePath: string; lineNumber: number; lineContent: string; matchStart: number; matchEnd: number }> = []

  let pattern: RegExp
  try {
    if (options.useRegex) {
      pattern = new RegExp(query, options.caseSensitive ? 'g' : 'gi')
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const wordBoundary = options.wholeWord ? '\\b' : ''
      pattern = new RegExp(`${wordBoundary}${escaped}${wordBoundary}`, options.caseSensitive ? 'g' : 'gi')
    }
  } catch {
    return results
  }

  const excludePatterns = options.excludePatterns || ['node_modules', '.git', 'dist', '__pycache__']

  async function searchInDir(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue

        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (!excludePatterns.includes(entry.name)) {
            await searchInDir(fullPath)
          }
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown') || entry.name.endsWith('.txt'))) {
          if (options.includePatterns && options.includePatterns.length > 0) {
            const matches = options.includePatterns.some(p => entry.name.match(new RegExp(p)))
            if (!matches) continue
          }

          try {
            const content = await fs.readFile(fullPath, 'utf-8')
            const lines = content.split('\n')

            lines.forEach((line, index) => {
              const matches = line.matchAll(pattern)
              for (const match of matches) {
                results.push({
                  filePath: fullPath,
                  lineNumber: index + 1,
                  lineContent: line,
                  matchStart: match.index || 0,
                  matchEnd: (match.index || 0) + match[0].length
                })
              }
            })
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  await searchInDir(dirPath)
  return results
}

ipcMain.handle(IPC_CHANNELS.FILE.SEARCH_IN_DIRECTORY, async (_, { dirPath, query, options }: { dirPath: string; query: string; options?: { includePatterns?: string[]; excludePatterns?: string[]; caseSensitive?: boolean; wholeWord?: boolean; useRegex?: boolean } }) => {
  try {
    if (!query.trim()) {
      return createSuccessResponse([])
    }

    // Try ripgrep first for performance
    try {
      const results = await searchWithRipgrep(dirPath, query, options)
      return createSuccessResponse(results)
    } catch (rgError) {
      console.warn('Ripgrep search failed, falling back:', rgError)
      // Fallback to filesystem-based search
      const results = await searchFallback(dirPath, query, options)
      return createSuccessResponse(results)
    }
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Search failed: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.MINIMIZE, () => {
  mainWindow?.minimize()
  return createSuccessResponse(undefined)
})

ipcMain.handle(IPC_CHANNELS.WINDOW.MAXIMIZE, () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
  return createSuccessResponse(undefined)
})

ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE, () => {
  mainWindow?.close()
  return createSuccessResponse(undefined)
})

ipcMain.handle(IPC_CHANNELS.WINDOW.SET_ALWAYS_ON_TOP, (_, flag: boolean) => {
  mainWindow?.setAlwaysOnTop(flag)
  return createSuccessResponse(undefined)
})

ipcMain.handle(IPC_CHANNELS.WINDOW.OPEN_NEW_WINDOW, async (_, options?: { filePath?: string; tabData?: DetachedTabData }) => {
  try {
    const newWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false
      },
      show: false,
      backgroundColor: '#ffffff'
    })

    windows.set(newWindow.id, newWindow)

    newWindow.on('ready-to-show', () => {
      newWindow.show()
    })

    const filePath = options?.filePath
    const tabData = options?.tabData

    if (VITE_DEV_SERVER_URL) {
      const url = filePath 
        ? `${VITE_DEV_SERVER_URL}?file=${encodeURIComponent(filePath)}`
        : VITE_DEV_SERVER_URL
      newWindow.loadURL(url)
    } else {
      const htmlPath = filePath 
        ? `${path.join(RENDERER_DIST, 'index.html')}?file=${encodeURIComponent(filePath)}`
        : path.join(RENDERER_DIST, 'index.html')
      newWindow.loadFile(htmlPath)
    }

    if (tabData) {
      newWindow.webContents.once('did-finish-load', () => {
        newWindow.webContents.send('tab:detached', tabData)
      })
    }

    return createSuccessResponse(newWindow.id)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to open new window: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.MERGE_TAB, async (_, { tabData, targetWindowId }: { tabData: DetachedTabData; targetWindowId: number }) => {
  try {
    const targetWindow = windows.get(targetWindowId)
    if (!targetWindow || targetWindow.isDestroyed()) {
      return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Target window not found')
    }
    
    targetWindow.webContents.send('tab:merge', tabData)
    return createSuccessResponse(true)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, `Failed to merge tab: ${error.message}`)
  }
})

ipcMain.handle(IPC_CHANNELS.WINDOW.GET_WINDOW_ID, (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  return createSuccessResponse(window?.id || null)
})

ipcMain.handle(IPC_CHANNELS.WINDOW.LIST_WINDOWS, () => {
  const windowList = Array.from(windows.entries()).map(([id, win]) => ({
    id,
    title: win.getTitle()
  }))
  return createSuccessResponse(windowList)
})

app.whenReady().then(() => {
  createMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
