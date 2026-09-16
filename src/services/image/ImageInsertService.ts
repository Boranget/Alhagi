import type { ImageSource } from '@core/entities/image/ImageSource'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import { ImageInsertResult } from '@core/entities/image/ImageInsertResult'
import type { IImageInsertStrategy, ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'
import type { IImageStorage } from '@core/interfaces/services/image/IImageStorage'
import { KeepOriginalStrategy } from './strategies/KeepOriginalStrategy'
import { CopyStrategy } from './strategies/CopyStrategy'

export class ImageInsertService {
  private strategies: Map<string, IImageInsertStrategy>

  constructor(imageStorage: IImageStorage) {
    this.strategies = new Map()
    this.strategies.set('keep-original', new KeepOriginalStrategy())
    this.strategies.set('copy', new CopyStrategy(imageStorage))
  }

  registerStrategy(mode: string, strategy: IImageInsertStrategy): void {
    this.strategies.set(mode, strategy)
  }

  async insertWith(source: ImageSource, options: ImageInsertOptions, context: ImageInsertContext): Promise<ImageInsertResult> {
    const isClipboard = source.isClipboardImage()
    const effectiveMode = (isClipboard && options.mode === 'keep-original')
      ? 'copy'
      : options.mode

    console.log('[ImageInsertService] insertWith:', {
      sourceType: source.type,
      isClipboard,
      requestedMode: options.mode,
      effectiveMode,
    })

    const strategy = this.strategies.get(effectiveMode)
    if (!strategy) {
      return ImageInsertResult.failure(`Unknown insert mode: ${options.mode}`)
    }

    if (!options.shouldApplyToSource(source.isLocalFile())) {
      return ImageInsertResult.success(source.data)
    }

    return strategy.execute(source, options, context)
  }

  getAvailableModes(): string[] {
    return Array.from(this.strategies.keys())
  }
}
