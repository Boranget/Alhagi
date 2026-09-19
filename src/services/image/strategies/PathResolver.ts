import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'
import type { IImageStorage } from '@core/domain/ports/services/image/IImageStorage'
import { PathTemplate } from './PathTemplate'
import { isAbsolute, basename, extname, join, normalizePath } from './pathUtils'

export interface ResolvedPaths {
  targetDir: string
  imageFileName: string
}

export class PathResolver {
  constructor(private imageStorage: IImageStorage) {}

  async resolve(options: ImageInsertOptions, context: ImageInsertContext): Promise<ResolvedPaths> {
    const targetDir = await this.resolveTargetDir(options, context)
    const imageFileName = PathTemplate.resolveImageFileName(
      context.fileName || 'image.png',
      this.extractFileNameTemplate(options.copyPath)
    )
    return { targetDir, imageFileName }
  }

  private async resolveTargetDir(
    options: ImageInsertOptions,
    context: ImageInsertContext
  ): Promise<string> {
    const template = options.copyPath

    if (isAbsolute(template)) {
      return template
    }

    if (!context.currentFileDir) {
      const documentsDir = await this.imageStorage.getDocumentsDirectory()
      return join(documentsDir, 'alhagi', 'images')
    }

    const expanded = PathTemplate.expand(template, {
      fileName: context.currentFilePath ? basename(context.currentFilePath, extname(context.currentFilePath)) : undefined,
      fileDir: context.currentFileDir ? basename(context.currentFileDir) : undefined,
    })

    return normalizePath(join(context.currentFileDir, expanded))
  }

  private extractFileNameTemplate(copyPath: string): string | undefined {
    const bn = basename(copyPath)
    return bn.includes('{') ? bn : undefined
  }
}
