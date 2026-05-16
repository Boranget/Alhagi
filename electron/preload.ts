import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export enum IPCErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_SAVE_ERROR = 'FILE_SAVE_ERROR',
  FILE_DELETE_ERROR = 'FILE_DELETE_ERROR',
  FILE_RENAME_ERROR = 'FILE_RENAME_ERROR',
  FILE_CREATE_ERROR = 'FILE_CREATE_ERROR',
  DIRECTORY_READ_ERROR = 'DIRECTORY_READ_ERROR',
  DIRECTORY_CREATE_ERROR = 'DIRECTORY_CREATE_ERROR',
  DIALOG_CANCELLED = 'DIALOG_CANCELLED',
  INVALID_PATH = 'INVALID_PATH',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface IPCResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
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

export interface ElectronAPI {
  openFile: () => Promise<IPCResponse<{ filePath: string; content: string } | null>>
  saveFile: (filePath: string, content: string) => Promise<IPCResponse<boolean>>
  saveAsFile: (content: string, defaultPath?: string) => Promise<IPCResponse<string | null>>
  readFile: (filePath: string) => Promise<IPCResponse<string>>
  openFolder: () => Promise<IPCResponse<{ path: string; tree: FileTreeNode[] } | null>>
  readDirectory: (dirPath: string) => Promise<IPCResponse<DirectoryEntry[]>>
  createFile: (dirPath: string, fileName: string) => Promise<IPCResponse<string | null>>
  createDirectory: (dirPath: string, dirName: string) => Promise<IPCResponse<string | null>>
  deleteFile: (filePath: string) => Promise<IPCResponse<boolean>>
  renameFile: (oldPath: string, newName: string) => Promise<IPCResponse<string | null>>
  minimize: () => Promise<IPCResponse<void>>
  maximize: () => Promise<IPCResponse<void>>
  close: () => Promise<IPCResponse<void>>
  setAlwaysOnTop: (flag: boolean) => Promise<IPCResponse<void>>
  onNewFile: (callback: () => void) => () => void
  onOpenFile: (callback: () => void) => () => void
  onSave: (callback: () => void) => () => void
  onSaveAs: (callback: () => void) => () => void
  onViewMode: (callback: (mode: string) => void) => () => void
}

function createIpcHandler<T>(
  channel: string,
  data?: any
): Promise<IPCResponse<T>> {
  return ipcRenderer.invoke(channel, data)
}

function createMenuListener(
  channel: string,
  callback: (...args: any[]) => void
): () => void {
  const handler = (_event: IpcRendererEvent, ...args: any[]) => callback(...args)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: ElectronAPI = {
  openFile: () => createIpcHandler('file:open'),
  
  saveFile: (filePath, content) => 
    createIpcHandler('file:save', { filePath, content }),
  
  saveAsFile: (content, defaultPath) => 
    createIpcHandler('file:save-as', { content, defaultPath }),
  
  readFile: (filePath) => 
    createIpcHandler('file:read', filePath),
  
  openFolder: () => 
    createIpcHandler('file:open-folder'),
  
  readDirectory: (dirPath) => 
    createIpcHandler('file:read-directory', dirPath),
  
  createFile: (dirPath, fileName) => 
    createIpcHandler('file:create', { dirPath, fileName, type: 'file' }),
  
  createDirectory: (dirPath, dirName) => 
    createIpcHandler('file:create', { dirPath, fileName: dirName, type: 'directory' }),
  
  deleteFile: (filePath) => 
    createIpcHandler('file:delete', filePath),
  
  renameFile: (oldPath, newName) => 
    createIpcHandler('file:rename', { oldPath, newName }),
  
  minimize: () => 
    createIpcHandler('window:minimize'),
  
  maximize: () => 
    createIpcHandler('window:maximize'),
  
  close: () => 
    createIpcHandler('window:close'),
  
  setAlwaysOnTop: (flag) => 
    createIpcHandler('window:set-always-on-top', flag),
  
  onNewFile: (callback) => 
    createMenuListener('menu:new-file', callback),
  
  onOpenFile: (callback) => 
    createMenuListener('menu:open-file', callback),
  
  onSave: (callback) => 
    createMenuListener('menu:save', callback),
  
  onSaveAs: (callback) => 
    createMenuListener('menu:save-as', callback),
  
  onViewMode: (callback) => 
    createMenuListener('menu:view-mode', callback)
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type { ElectronAPI, FileTreeNode, DirectoryEntry, IPCResponse }
