import type { ImageSource } from '@core/entities/image/ImageSource'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import { ImageInsertResult } from '@core/entities/image/ImageInsertResult'
import type { IImageInsertStrategy, ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'
import type { IImageStorage } from '@core/interfaces/services/image/IImageStorage'
import { KeepOriginalStrategy } from './strategies/KeepOriginalStrategy'
import { CopyStrategy } from './strategies/CopyStrategy'

export class ImageInsertService {
  private strategies: Map<string, IImageInsertStrategy>
  private contextProvider: () => ImageInsertContext

  constructor(
    private imageStorage: IImageStorage,
    contextProvider?: () => ImageInsertContext
  ) {
    this.strategies = new Map()
    this.strategies.set('keep-original', new KeepOriginalStrategy())
    this.strategies.set('copy', new CopyStrategy(imageStorage))

    this.contextProvider = contextProvider || (() => ({
      editorInsertImage: () => {},
    }))
  }

  registerStrategy(mode: string, strategy: IImageInsertStrategy): void {
    this.strategies.set(mode, strategy)
  }

  setContextProvider(provider: () => ImageInsertContext): void {
    this.contextProvider = provider
  }

  async insert(source: ImageSource, options: ImageInsertOptions): Promise<ImageInsertResult> {
    console.log('[ImageInsertService] insert called:', { mode: options.mode, sourceType: source.type, sourceData: source.data.substring(0, 80) })

    const strategy = this.strategies.get(options.mode)
    if (!strategy) {
      console.error('[ImageInsertService] Unknown mode:', options.mode)
      return ImageInsertResult.failure(`Unknown insert mode: ${options.mode}`)
    }

    console.log('[ImageInsertService] shouldApply:', options.shouldApplyToSource(source.isLocalFile()), 'isLocal:', source.isLocalFile())

    if (!options.shouldApplyToSource(source.isLocalFile())) {
      console.log('[ImageInsertService] Skipping (applyToSource filter)')
      return ImageInsertResult.success(source.data)
    }

    const context = this.contextProvider()
    console.log('[ImageInsertService] Calling strategy:', options.mode, 'context:', { currentFileDir: context.currentFileDir })
    return strategy.execute(source, options, context)
  }

  async insertWith(source: ImageSource, options: ImageInsertOptions, context: ImageInsertContext): Promise<ImageInsertResult> {
    console.log('[ImageInsertService] insertWith called:', { mode: options.mode, sourceType: source.type })

    const strategy = this.strategies.get(options.mode)
    if (!strategy) {
      console.error('[ImageInsertService] Unknown mode:', options.mode)
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
