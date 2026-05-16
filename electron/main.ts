import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import Store from 'electron-store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  lastModified: number
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
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:new-file') },
        { label: '打开', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:open-file') },
        { label: '打开文件夹', click: () => mainWindow?.webContents.send('menu:open-folder') },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:save') },
        { label: '另存为', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('menu:save-as') },
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
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: 'WYSIWYG 模式', click: () => mainWindow?.webContents.send('menu:view-mode', 'wysiwyg') },
        { label: '源码模式', click: () => mainWindow?.webContents.send('menu:view-mode', 'source') },
        { label: '分屏模式', click: () => mainWindow?.webContents.send('menu:view-mode', 'split') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
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

ipcMain.handle('file:open', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const filePath = result.filePaths[0]
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { filePath, content }
  } catch (error) {
    console.error('Failed to read file:', error)
    throw error
  }
})

ipcMain.handle('file:save', async (_, { filePath, content }) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save file:', error)
    throw error
  }
})

ipcMain.handle('file:save-as', async (_, { content, defaultPath }) => {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'untitled.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (result.canceled || !result.filePath) {
    return null
  }

  try {
    await fs.writeFile(result.filePath, content, 'utf-8')
    return result.filePath
  } catch (error) {
    console.error('Failed to save file:', error)
    throw error
  }
})

ipcMain.handle('file:read', async (_, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    console.error('Failed to read file:', error)
    throw error
  }
})

ipcMain.handle('file:open-folder', async () => {
  if (!mainWindow) return null
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const folderPath = result.filePaths[0]
  try {
    const tree = await buildFileTree(folderPath, 3)
    return { path: folderPath, tree }
  } catch (error) {
    console.error('Failed to read folder:', error)
    throw error
  }
})

async function buildFileTree(dirPath: string, maxDepth: number, currentDepth = 0): Promise<any[]> {
  if (currentDepth >= maxDepth) return []
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const result = []
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      
      const fullPath = path.join(dirPath, entry.name)
      
      if (entry.isDirectory()) {
        const children = await buildFileTree(fullPath, maxDepth, currentDepth + 1)
        result.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          children,
          expanded: false
        })
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
        result.push({
          name: entry.name,
          path: fullPath,
          type: 'file'
        })
      }
    }
    
    return result
  } catch (error) {
    console.error('Failed to read directory:', error)
    return []
  }
}

ipcMain.handle('file:read-directory', async (_, dirPath: string) => {
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
    
    return result
  } catch (error) {
    console.error('Failed to read directory:', error)
    throw error
  }
})

ipcMain.handle('file:create', async (_, { dirPath, fileName, type }) => {
  try {
    const newPath = path.join(dirPath, fileName)
    
    if (type === 'directory') {
      await fs.mkdir(newPath, { recursive: true })
    } else {
      await fs.writeFile(newPath, '', 'utf-8')
    }
    
    return newPath
  } catch (error) {
    console.error('Failed to create file/directory:', error)
    throw error
  }
})

ipcMain.handle('file:delete', async (_, filePath: string) => {
  try {
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) {
      await fs.rm(filePath, { recursive: true })
    } else {
      await fs.unlink(filePath)
    }
    return true
  } catch (error) {
    console.error('Failed to delete:', error)
    throw error
  }
})

ipcMain.handle('file:rename', async (_, { oldPath, newName }) => {
  try {
    const dir = path.dirname(oldPath)
    const newPath = path.join(dir, newName)
    await fs.rename(oldPath, newPath)
    return newPath
  } catch (error) {
    console.error('Failed to rename:', error)
    throw error
  }
})

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:set-always-on-top', (_, flag: boolean) => {
  mainWindow?.setAlwaysOnTop(flag)
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
