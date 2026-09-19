import type { IImageStorage, ImageStorageResult } from '@core/domain/ports/services/image/IImageStorage'
import type { IFileSystem } from '@core/domain/ports/gateways/IFileSystem'

export class ImageStorageGateway implements IImageStorage {
  constructor(private fileSystem: IFileSystem) {}

  async saveImage(
    data: string,
    fileName: string,
    mimeType: string,
    targetDir: string
  ): Promise<ImageStorageResult> {
    try {
      const filePath = `${targetDir}/${fileName}`
      await this.fileSystem.writeBinary(filePath, data, mimeType)
      return {
        success: true,
        filePath,
        relativePath: fileName,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save image',
      }
    }
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    await this.fileSystem.ensureDirectory(dirPath)
  }

  async getDocumentsDirectory(): Promise<string> {
    return this.fileSystem.getDocumentsDirectory()
  }
}
