import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; content: string } | null>
  saveFile: (filePath: string, content: string) => Promise<boolean>
  saveAsFile: (content: string, defaultPath?: string) => Promise<string | null>
  readFile: (filePath: string) => Promise<string>
  openFolder: () => Promise<{ path: string; tree: FileTreeNode[] } | null>
  readDirectory: (dirPath: string) => Promise<DirectoryEntry[]>
  createFile: (dirPath: string, fileName: string) => Promise<string | null>
  createDirectory: (dirPath: string, dirName: string) => Promise<string | null>
  deleteFile: (filePath: string) => Promise<boolean>
  renameFile: (oldPath: string, newName: string) => Promise<string | null>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  setAlwaysOnTop: (flag: boolean) => Promise<void>
  onNewFile: (callback: () => void) => void
  onOpenFile: (callback: () => void) => void
  onSave: (callback: () => void) => void
  onSaveAs: (callback: () => void) => void
  onViewMode: (callback: (mode: string) => void) => void
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  expanded?: boolean
}

export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  lastModified: number
}

const api: ElectronAPI = {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  saveAsFile: (content, defaultPath) => ipcRenderer.invoke('file:save-as', { content, defaultPath }),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  openFolder: () => ipcRenderer.invoke('file:open-folder'),
  readDirectory: (dirPath) => ipcRenderer.invoke('file:read-directory', dirPath),
  createFile: (dirPath, fileName) => ipcRenderer.invoke('file:create', { dirPath, fileName, type: 'file' }),
  createDirectory: (dirPath, dirName) => ipcRenderer.invoke('file:create', { dirPath, fileName: dirName, type: 'directory' }),
  deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),
  renameFile: (oldPath, newName) => ipcRenderer.invoke('file:rename', { oldPath, newName }),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:set-always-on-top', flag),
  onNewFile: (callback) => ipcRenderer.on('menu:new-file', () => callback()),
  onOpenFile: (callback) => ipcRenderer.on('menu:open-file', () => callback()),
  onSave: (callback) => ipcRenderer.on('menu:save', () => callback()),
  onSaveAs: (callback) => ipcRenderer.on('menu:save-as', () => callback()),
  onViewMode: (callback) => ipcRenderer.on('menu:view-mode', (_, mode) => callback(mode))
}

contextBridge.exposeInMainWorld('electronAPI', api)
