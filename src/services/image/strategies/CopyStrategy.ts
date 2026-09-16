import type { ImageSource } from '@core/entities/image/ImageSource'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import { ImageInsertResult } from '@core/entities/image/ImageInsertResult'
import type { IImageInsertStrategy } from '@core/interfaces/services/image/IImageInsertStrategy'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'
import type { IImageStorage } from '@core/interfaces/services/image/IImageStorage'
import { PathTemplate } from './PathTemplate'
import { escapeImageUrl } from './escapeImageUrl'
import { isAbsolute, basename, extname, join, normalizePath } from './pathUtils'
import { computeRelative } from './localImageProtocol'

export class CopyStrategy implements IImageInsertStrategy {
  constructor(private imageStorage: IImageStorage) {}

  async execute(
    source: ImageSource,
    options: ImageInsertOptions,
    context: ImageInsertContext
  ): Promise<ImageInsertResult> {
    try {
      console.log('[CopyStrategy] execute called:', { sourceType: source.type, fileName: source.fileName })

      const targetDir = await this.resolveTargetDir(options, context)
      console.log('[CopyStrategy] targetDir:', targetDir)

      console.log('[CopyStrategy] Calling ensureDirectory...')
      await this.imageStorage.ensureDirectory(targetDir)
      console.log('[CopyStrategy] ensureDirectory done')

      const imageFileName = PathTemplate.resolveImageFileName(
        source.fileName,
        this.extractFileNameTemplate(options.copyPath)
      )
      console.log('[CopyStrategy] imageFileName:', imageFileName)

      let imageData = source.data
      let mimeType = source.mimeType

      if (imageData.startsWith('data:')) {
        const base64Match = imageData.match(/^data:[^;]+;base64,(.+)$/)
        if (base64Match) {
          imageData = base64Match[1]
        }
      }

      if (source.type === 'url' && source.data.startsWith('http')) {
        console.log('[CopyStrategy] Fetching remote image:', source.data.substring(0, 80))
        try {
          const fetched = await this.fetchImageAsBase64(source.data)
          imageData = fetched.base64
          mimeType = fetched.mimeType
          console.log('[CopyStrategy] Image fetched successfully, base64 length:', imageData.length)
        } catch (fetchError) {
          console.error('[CopyStrategy] Failed to fetch image:', fetchError)
          return ImageInsertResult.failure(fetchError instanceof Error ? fetchError.message : 'Failed to fetch image')
        }
      }

      console.log('[CopyStrategy] Calling saveImage...')
      const saveResult = await this.imageStorage.saveImage(
        imageData,
        imageFileName,
        mimeType,
        targetDir
      )
      console.log('[CopyStrategy] saveResult:', saveResult)

      if (!saveResult.success) {
        return ImageInsertResult.failure(saveResult.error || 'Failed to save image')
      }

      let imageUrl = saveResult.filePath || ''
      console.log('[CopyStrategy] imageUrl saved:', imageUrl)

      let editorUrl: string
      if (context.currentFileDir && options.preferRelativePath) {
        editorUrl = computeRelative(context.currentFileDir, imageUrl)
      } else {
        editorUrl = imageUrl.replace(/\\/g, '/')
      }

      console.log('[CopyStrategy] editorUrl:', editorUrl)

      if (context.editorInsertImage) {
        context.editorInsertImage(editorUrl, source.fileName)
        console.log('[CopyStrategy] editorInsertImage called')
      } else {
        console.warn('[CopyStrategy] editorInsertImage is not defined!')
      }

      return ImageInsertResult.success(imageUrl, saveResult.relativePath)
    } catch (error) {
      console.error('[CopyStrategy] execute failed:', error)
      return ImageInsertResult.failure(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async resolveTargetDir(
    options: ImageInsertOptions,
    context: ImageInsertContext
  ): Promise<string> {
    const template = options.copyPath
    console.log('[CopyStrategy] resolveTargetDir template:', template, 'currentFileDir:', context.currentFileDir)

    if (isAbsolute(template)) {
      console.log('[CopyStrategy] Absolute path, using as-is:', template)
      return template
    }

    if (!context.currentFileDir) {
      console.log('[CopyStrategy] No currentFileDir, using documents dir')
      const documentsDir = await this.imageStorage.getDocumentsDirectory()
      console.log('[CopyStrategy] documentsDir:', documentsDir)
      return join(documentsDir, 'alhagi', 'images')
    }

    const expanded = PathTemplate.expand(template, {
      fileName: context.currentFilePath ? basename(context.currentFilePath, extname(context.currentFilePath)) : undefined,
      fileDir: context.currentFileDir ? basename(context.currentFileDir) : undefined,
    })
    console.log('[CopyStrategy] expanded template:', expanded)

    const resolved = normalizePath(join(context.currentFileDir, expanded))
    console.log('[CopyStrategy] resolved targetDir:', resolved)
    return resolved
  }

  private extractFileNameTemplate(copyPath: string): string | undefined {
    const bn = basename(copyPath)
    if (bn.includes('{')) {
      return bn
    }
    return undefined
  }

  private async fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const buffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)

    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    const base64 = btoa(binary)

    return {
      base64: base64,
      mimeType: contentType,
    }
  }
}
