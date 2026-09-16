import type { ImageSource } from '@core/entities/image/ImageSource'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertResult } from '@core/entities/image/ImageInsertResult'

export interface IImageInsertStrategy {
  execute(source: ImageSource, options: ImageInsertOptions, context: ImageInsertContext): Promise<ImageInsertResult>
}

export interface ImageInsertContext {
  currentFilePath?: string
  currentFileDir?: string
  editorInsertImage: (imageUrl: string, altText?: string) => void
}
