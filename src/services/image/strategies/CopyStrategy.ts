import type { ImageSource } from '@core/entities/image/ImageSource'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import { ImageInsertResult } from '@core/entities/image/ImageInsertResult'
import type { IImageInsertStrategy, ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'
import type { IImageStorage } from '@core/domain/ports/services/image/IImageStorage'
import { PathResolver } from './PathResolver'
import { ImageFetcher } from './ImageFetcher'
import { computeRelative } from './localImageProtocol'
import { computeSHA1 } from './hashUtils'
import { extname } from './pathUtils'

export class CopyStrategy implements IImageInsertStrategy {
  private pathResolver: PathResolver
  private imageFetcher: ImageFetcher

  constructor(private imageStorage: IImageStorage) {
    this.pathResolver = new PathResolver(imageStorage)
    this.imageFetcher = new ImageFetcher()
  }

  async execute(
    source: ImageSource,
    options: ImageInsertOptions,
    context: ImageInsertContext
  ): Promise<ImageInsertResult> {
    try {
      const { targetDir } = await this.pathResolver.resolve(options, {
        ...context,
        fileName: source.fileName,
      })

      await this.imageStorage.ensureDirectory(targetDir)

      let imageData = source.data
      let mimeType = source.mimeType

      if (imageData.startsWith('data:')) {
        const base64Match = imageData.match(/^data:[^;]+;base64,(.+)$/)
        if (base64Match) {
          imageData = base64Match[1]
        }
      }

      if (source.type === 'url' && source.data.startsWith('http')) {
        const fetched = await this.imageFetcher.fetch(source.data)
        imageData = fetched.base64
        mimeType = fetched.mimeType
      }

      const rawBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0))
      const hash = await computeSHA1(rawBytes)
      const ext = extname(source.fileName) || '.png'
      const hashFileName = `${hash}${ext}`

      const saveResult = await this.imageStorage.saveImage(imageData, hashFileName, mimeType, targetDir)
      if (!saveResult.success) {
        return ImageInsertResult.failure(saveResult.error || 'Failed to save image')
      }

      const imageUrl = saveResult.filePath || ''
      const editorUrl = (context.currentFileDir && options.preferRelativePath)
        ? computeRelative(context.currentFileDir, imageUrl)
        : imageUrl.replace(/\\/g, '/')

      if (context.editorInsertImage) {
        context.editorInsertImage(editorUrl, source.fileName)
      }

      return ImageInsertResult.success(imageUrl, saveResult.relativePath)
    } catch (error) {
      return ImageInsertResult.failure(error instanceof Error ? error.message : 'Unknown error')
    }
  }
}
