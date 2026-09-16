import type { IImageStorage, ImageStorageResult } from '@core/interfaces/services/image/IImageStorage'
import type { IFileSystem } from '@core/interfaces/gateways/IFileSystem'

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
      console.log('[ImageStorageGateway] saveImage:', { filePath, dataLength: data.length, mimeType })

      await this.fileSystem.writeBinary(filePath, data, mimeType)
      console.log('[ImageStorageGateway] writeBinary done')

      return {
        success: true,
        filePath,
        relativePath: fileName,
      }
    } catch (error) {
      console.error('[ImageStorageGateway] saveImage failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save image',
      }
    }
  }

  async getImagePath(fileName: string, targetDir: string): Promise<string> {
    return `${targetDir}/${fileName}`
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    console.log('[ImageStorageGateway] ensureDirectory:', dirPath)
    await this.fileSystem.ensureDirectory(dirPath)
    console.log('[ImageStorageGateway] ensureDirectory done')
  }

  async getRelativePath(fromPath: string, toPath: string): Promise<string> {
    const normalizedFrom = fromPath.replace(/\\/g, '/')
    const normalizedTo = toPath.replace(/\\/g, '/')

    if (normalizedTo.startsWith(normalizedFrom)) {
      const relative = normalizedTo.substring(normalizedFrom.length)
      return relative.startsWith('/') ? `.${relative}` : `./${relative}`
    }

    const fromParts = normalizedFrom.split('/')
    const toParts = normalizedTo.split('/')

    let commonLength = 0
    while (
      commonLength < fromParts.length &&
      commonLength < toParts.length &&
      fromParts[commonLength] === toParts[commonLength]
    ) {
      commonLength++
    }

    const upCount = fromParts.length - commonLength
    const downParts = toParts.slice(commonLength)

    const relativeParts = [
      ...Array(upCount).fill('..'),
      ...downParts,
    ]

    return relativeParts.join('/')
  }

  async getDocumentsDirectory(): Promise<string> {
    return this.fileSystem.getDocumentsDirectory()
  }
}
