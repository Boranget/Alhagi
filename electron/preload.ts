import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { 
  IPCResponse, 
  FileTreeNode,
  DirectoryEntry,
  IPC_CHANNELS,
  MENU_EVENTS,
  FILE_TYPES
} from '../electron-protocol'

export type { IPCResponse, FileTreeNode, DirectoryEntry } from '../electron-protocol'

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
  moveFile: (sourcePath: string, targetDir: string) => Promise<IPCResponse<string | null>>
  copyFile: (sourcePath: string, targetDir: string) => Promise<IPCResponse<string | null>>
  selectDirectory: () => Promise<IPCResponse<string | null>>
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
  data?: unknown
): Promise<IPCResponse<T>> {
  return ipcRenderer.invoke(channel, data)
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
  
  saveFile: (filePath, content) => 
    createIpcHandler(IPC_CHANNELS.FILE.SAVE, { filePath, content }),
  
  saveAsFile: (content, defaultPath) => 
    createIpcHandler(IPC_CHANNELS.FILE.SAVE_AS, { content, defaultPath }),
  
  readFile: (filePath) => 
    createIpcHandler(IPC_CHANNELS.FILE.READ, filePath),
  
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
  
  selectDirectory: () => 
    createIpcHandler(IPC_CHANNELS.DIALOG.SELECT_DIRECTORY),
  
  minimize: () => 
    createIpcHandler(IPC_CHANNELS.WINDOW.MINIMIZE),
  
  maximize: () => 
    createIpcHandler(IPC_CHANNELS.WINDOW.MAXIMIZE),
  
  close: () => 
    createIpcHandler(IPC_CHANNELS.WINDOW.CLOSE),
  
  setAlwaysOnTop: (flag) => 
    createIpcHandler(IPC_CHANNELS.WINDOW.SET_ALWAYS_ON_TOP, flag),
  
  onNewFile: (callback) => 
    createMenuListener(MENU_EVENTS.NEW_FILE, callback),
  
  onOpenFile: (callback) => 
    createMenuListener(MENU_EVENTS.OPEN_FILE, callback),
  
  onSave: (callback) => 
    createMenuListener(MENU_EVENTS.SAVE, callback),
  
  onSaveAs: (callback) => 
    createMenuListener(MENU_EVENTS.SAVE_AS, callback),
  
  onViewMode: (callback) => 
    createMenuListener(MENU_EVENTS.VIEW_MODE, callback)
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type { ElectronAPI }
