import type { ImageSource } from '@core/entities/image/ImageSource'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import { ImageInsertResult } from '@core/entities/image/ImageInsertResult'
import type { IImageInsertStrategy } from '@core/interfaces/services/image/IImageInsertStrategy'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'
import { escapeImageUrl } from './escapeImageUrl'

export class KeepOriginalStrategy implements IImageInsertStrategy {
  async execute(
    source: ImageSource,
    options: ImageInsertOptions,
    context: ImageInsertContext
  ): Promise<ImageInsertResult> {
    try {
      let imageUrl = source.data

      if (options.escapeUrl) {
        imageUrl = escapeImageUrl(imageUrl)
      }

      if (context.editorInsertImage) {
        context.editorInsertImage(imageUrl, source.fileName)
      }

      return ImageInsertResult.success(imageUrl)
    } catch (error) {
      return ImageInsertResult.failure(error instanceof Error ? error.message : 'Unknown error')
    }
  }
}
