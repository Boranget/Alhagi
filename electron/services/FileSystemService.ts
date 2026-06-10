// ============================================================
// Alhagi FileSystemService - 全部文件 IO 的 IPC handler
// ============================================================

import { app, dialog } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import {
  IPCErrorCode,
  IPC_CHANNELS,
  FILE_TYPES,
  LINE_ENDINGS,
  type LineEnding,
  type FileTreeNode,
  type DirectoryEntry,
  createSuccessResponse,
  createErrorResponse,
} from '../../electron-protocol'
import { registerHandler } from '../ipc-handler'
import type { WindowManager } from './WindowManager'

export class FileSystemService {
  constructor(private windowManager: WindowManager) {}

  registerHandlers(): void {
    this.registerOpen()
    this.registerSave()
    this.registerSaveAs()
    this.registerSaveBinary()
    this.registerRead()
    this.registerReadBinary()
    this.registerOpenFolder()
    this.registerReadDirectory()
    this.registerCreate()
    this.registerDelete()
    this.registerRename()
    this.registerMove()
    this.registerCopy()
    this.registerShowInFolder()
    this.registerGetDocumentsDirectory()
    this.registerEnsureDirectory()
  }

  // ---------- 内部 helper ----------

  private applyLineEnding(content: string, lineEnding?: LineEnding): string {
    if (!lineEnding || !(lineEnding in LINE_ENDINGS)) return content
    const targetEnding = LINE_ENDINGS[lineEnding]
    return content.replace(/\r\n/g, '\n').replace(/\n/g, targetEnding)
  }

  private async buildFileTree(dirPath: string, maxDepth: number, currentDepth = 0): Promise<FileTreeNode[]> {
    if (currentDepth >= maxDepth) return []
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const result: FileTreeNode[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          const children = await this.buildFileTree(fullPath, maxDepth, currentDepth + 1)
          result.push({ name: entry.name, path: fullPath, type: FILE_TYPES.DIRECTORY, children, expanded: false })
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          result.push({ name: entry.name, path: fullPath, type: FILE_TYPES.FILE })
        }
      }
      return result
    } catch (error) {
      console.error('[FileSystemService] Failed to read directory:', error)
      return []
    }
  }

  // ---------- handler 注册 ----------

  private registerOpen(): void {
    registerHandler(IPC_CHANNELS.FILE.OPEN, IPCErrorCode.FILE_READ_ERROR, async () => {
      const win = this.windowManager.getMainWindow()
      if (!win) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      })
      if (result.canceled || result.filePaths.length === 0) return createSuccessResponse(null)
      const filePath = result.filePaths[0]
      const content = await fs.readFile(filePath, 'utf-8')
      return createSuccessResponse({ filePath, content })
    })
  }

  private registerSave(): void {
    registerHandler(
      IPC_CHANNELS.FILE.SAVE,
      IPCErrorCode.FILE_SAVE_ERROR,
      async (_, { filePath, content, lineEnding }: { filePath: string; content: string; lineEnding?: LineEnding }) => {
        const finalContent = this.applyLineEnding(content, lineEnding)
        await fs.writeFile(filePath, finalContent, 'utf-8')
        return true
      },
    )
  }

  private registerSaveAs(): void {
    registerHandler(
      IPC_CHANNELS.FILE.SAVE_AS,
      IPCErrorCode.FILE_SAVE_ERROR,
      async (_, { content, defaultPath, lineEnding }: { content: string; defaultPath?: string; lineEnding?: LineEnding }) => {
        const win = this.windowManager.getMainWindow()
        if (!win) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')
        const result = await dialog.showSaveDialog(win, {
          defaultPath: defaultPath || 'untitled.md',
          filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: '所有文件', extensions: ['*'] },
          ],
        })
        if (result.canceled || !result.filePath) return createSuccessResponse(null)
        const finalContent = this.applyLineEnding(content, lineEnding)
        await fs.writeFile(result.filePath, finalContent, 'utf-8')
        return createSuccessResponse(result.filePath)
      },
    )
  }

  private registerSaveBinary(): void {
    registerHandler(
      IPC_CHANNELS.FILE.SAVE_BINARY,
      IPCErrorCode.FILE_SAVE_ERROR,
      async (_, { filePath, content }: { filePath: string; content: string }) => {
        if (!filePath || typeof filePath !== 'string') {
          return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
        }
        const dirPath = path.dirname(filePath)
        try {
          await fs.access(dirPath)
        } catch {
          await fs.mkdir(dirPath, { recursive: true })
        }
        const buffer = Buffer.from(content, 'base64')
        await fs.writeFile(filePath, buffer)
        return true
      },
    )
  }

  private registerRead(): void {
    registerHandler(IPC_CHANNELS.FILE.READ, IPCErrorCode.FILE_READ_ERROR, async (_, filePath: string) => {
      if (!filePath || typeof filePath !== 'string') {
        return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
      }
      const content = await fs.readFile(filePath, 'utf-8')
      return createSuccessResponse(content)
    })
  }

  private registerReadBinary(): void {
    registerHandler(IPC_CHANNELS.FILE.READ_BINARY, IPCErrorCode.FILE_READ_ERROR, async (_, filePath: string) => {
      if (!filePath || typeof filePath !== 'string') {
        return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
      }
      const buffer = await fs.readFile(filePath)
      const base64 = buffer.toString('base64')
      const ext = filePath.split('.').pop()?.toLowerCase()
      let mimeType = 'application/octet-stream'
      if (ext === 'png') mimeType = 'image/png'
      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
      else if (ext === 'gif') mimeType = 'image/gif'
      else if (ext === 'svg') mimeType = 'image/svg+xml'
      else if (ext === 'webp') mimeType = 'image/webp'
      return createSuccessResponse(`data:${mimeType};base64,${base64}`)
    })
  }

  private registerOpenFolder(): void {
    registerHandler(IPC_CHANNELS.FILE.OPEN_FOLDER, IPCErrorCode.DIRECTORY_READ_ERROR, async () => {
      const win = this.windowManager.getMainWindow()
      if (!win) return createErrorResponse(IPCErrorCode.UNKNOWN_ERROR, 'Window not initialized')
      const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      if (result.canceled || result.filePaths.length === 0) return createSuccessResponse(null)
      const folderPath = result.filePaths[0]
      const tree = await this.buildFileTree(folderPath, 10)
      return createSuccessResponse({ path: folderPath, tree })
    })
  }

  private registerReadDirectory(): void {
    registerHandler(IPC_CHANNELS.FILE.READ_DIRECTORY, IPCErrorCode.DIRECTORY_READ_ERROR, async (_, dirPath: string) => {
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
          lastModified: stats.mtimeMs,
        })
      }
      return result
    })
  }

  private registerCreate(): void {
    registerHandler(
      IPC_CHANNELS.FILE.CREATE,
      IPCErrorCode.FILE_CREATE_ERROR,
      async (_, { dirPath, fileName, type }: { dirPath: string; fileName: string; type: string }) => {
        const newPath = path.join(dirPath, fileName)
        if (type === FILE_TYPES.DIRECTORY) {
          await fs.mkdir(newPath, { recursive: true })
        } else {
          await fs.writeFile(newPath, '', 'utf-8')
        }
        return newPath
      },
    )
  }

  private registerDelete(): void {
    registerHandler(IPC_CHANNELS.FILE.DELETE, IPCErrorCode.FILE_DELETE_ERROR, async (_, filePath: string) => {
      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) await fs.rm(filePath, { recursive: true })
      else await fs.unlink(filePath)
      return true
    })
  }

  private registerRename(): void {
    registerHandler(
      IPC_CHANNELS.FILE.RENAME,
      IPCErrorCode.FILE_RENAME_ERROR,
      async (_, { oldPath, newName }: { oldPath: string; newName: string }) => {
        const dir = path.dirname(oldPath)
        const newPath = path.join(dir, newName)
        await fs.rename(oldPath, newPath)
        return newPath
      },
    )
  }

  private registerMove(): void {
    registerHandler(
      IPC_CHANNELS.FILE.MOVE,
      IPCErrorCode.FILE_MOVE_ERROR,
      async (_, { sourcePath, targetDir }: { sourcePath: string; targetDir: string }) => {
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
        } catch {
          // 跨盘移动时 rename 失败，回退到复制+删除
          const content = await fs.readFile(sourcePath)
          await fs.writeFile(targetPath, content)
          await fs.unlink(sourcePath)
        }
        return createSuccessResponse(targetPath)
      },
    )
  }

  private registerCopy(): void {
    registerHandler(
      IPC_CHANNELS.FILE.COPY,
      IPCErrorCode.FILE_COPY_ERROR,
      async (_, { sourcePath, targetDir }: { sourcePath: string; targetDir: string }) => {
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
      },
    )
  }

  private registerShowInFolder(): void {
    registerHandler(IPC_CHANNELS.FILE.SHOW_IN_FOLDER, IPCErrorCode.UNKNOWN_ERROR, async (_, filePath: string) => {
      if (!filePath || typeof filePath !== 'string') {
        return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid file path')
      }
      const { shell } = await import('electron')
      shell.showItemInFolder(filePath)
      return true
    })
  }

  private registerGetDocumentsDirectory(): void {
    registerHandler(IPC_CHANNELS.FILE.GET_DOCUMENTS_DIRECTORY, IPCErrorCode.UNKNOWN_ERROR, async () => {
      return app.getPath('documents')
    })
  }

  private registerEnsureDirectory(): void {
    registerHandler(IPC_CHANNELS.FILE.ENSURE_DIRECTORY, IPCErrorCode.DIRECTORY_CREATE_ERROR, async (_, dirPath: string) => {
      if (!dirPath || typeof dirPath !== 'string') {
        return createErrorResponse(IPCErrorCode.INVALID_PATH, 'Invalid directory path')
      }
      await fs.mkdir(dirPath, { recursive: true })
      return true
    })
  }
}
