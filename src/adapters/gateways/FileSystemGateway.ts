import type { IFileSystem, DirectoryEntry, FileStats } from '@core/domain/ports/gateways/IFileSystem'
import { ElectronService } from '@/services/electron/ElectronService'

export class FileSystemGateway implements IFileSystem {
  private electronService = ElectronService.getInstance()

  private getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || ''
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'ico': 'image/x-icon',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  async readFile(path: string): Promise<string> {
    const response = await this.electronService.readFile(path)
    if (response.success) {
      return response.data as string
    }
    throw new Error('Failed to read file')
  }

  async readBinary(path: string): Promise<{ data: string; mimeType: string }> {
    const response = await this.electronService.readBinaryFile(path)
    if (response.success) {
      return { data: response.data as string, mimeType: this.getMimeType(path) }
    }
    throw new Error('Failed to read binary file')
  }

  async writeFile(path: string, content: string): Promise<void> {
    const response = await this.electronService.saveFile(path, content)
    if (!response.success) {
      throw new Error('Failed to write file')
    }
  }

  async writeBinary(path: string, data: string, _mimeType: string): Promise<void> {
    const response = await this.electronService.saveBinaryFile(path, data)
    if (!response.success) {
      throw new Error('Failed to write binary file')
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const response = await this.electronService.readFile(path)
      return response.success
    } catch {
      return false
    }
  }

  async existsBatch(paths: string[]): Promise<boolean[]> {
    const results = await Promise.all(paths.map(p => this.exists(p)))
    return results
  }

  async mkdir(path: string): Promise<void> {
    const response = await this.electronService.ensureDirectory(path)
    if (!response.success) {
      throw new Error('Failed to create directory')
    }
  }

  async readdir(path: string): Promise<DirectoryEntry[]> {
    const response = await this.electronService.readDirectory(path)
    if (response.success) {
      return response.data as DirectoryEntry[]
    }
    throw new Error('Failed to read directory')
  }

  async stat(path: string): Promise<FileStats> {
    // ElectronService 没有直接的 stat 方法，使用组合策略：
    // 1. 尝试 readDirectory - 成功说明是目录
    // 2. 尝试 readFile - 成功说明是文件
    // 3. 都失败说明不存在
    const dirResponse = await this.electronService.readDirectory(path)
    if (dirResponse.success) {
      return {
        isDirectory: true,
        size: 0,
        lastModified: Date.now(),
      }
    }

    const fileResponse = await this.electronService.readFile(path)
    if (fileResponse.success) {
      const content = fileResponse.data as string
      return {
        isDirectory: false,
        size: new TextEncoder().encode(content).byteLength,
        lastModified: Date.now(),
      }
    }

    throw new Error('Failed to stat file')
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const response = await this.electronService.renameFile(oldPath, newPath)
    if (!response.success) {
      throw new Error('Failed to rename file')
    }
  }

  async delete(path: string): Promise<void> {
    const response = await this.electronService.deleteFile(path)
    if (!response.success) {
      throw new Error('Failed to delete file')
    }
  }

  async copy(source: string, destination: string): Promise<void> {
    const response = await this.electronService.copyFile(source, destination)
    if (!response.success) {
      throw new Error('Failed to copy file')
    }
  }

  async move(source: string, destination: string): Promise<void> {
    const response = await this.electronService.moveFile(source, destination)
    if (!response.success) {
      throw new Error('Failed to move file')
    }
  }

  async ensureDirectory(path: string): Promise<void> {
    await this.mkdir(path)
  }

  async showInFolder(path: string): Promise<void> {
    await this.electronService.showInFolder(path)
  }

  async getDocumentsDirectory(): Promise<string> {
    const response = await this.electronService.getDocumentsDirectory()
    if (response.success) {
      return response.data as string
    }
    throw new Error('Failed to get documents directory')
  }
}

let instance: FileSystemGateway | null = null

export function useFileSystemGateway(): FileSystemGateway {
  if (!instance) {
    instance = new FileSystemGateway()
  }
  return instance
}
