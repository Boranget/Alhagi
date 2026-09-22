import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'
import { fileToImageSource, blobToImageSource, urlToImageSource } from '@/services/image/ImagePasteHandler'
import { $prose } from '@milkdown/utils'

const imagePastePluginKey = new PluginKey('imagePaste')

export function createImagePastePlugin(
  imageInsertService: ImageInsertService,
  getOptions: () => ImageInsertOptions,
  getContext: () => ImageInsertContext
) {
  return $prose(() => new Plugin({
    key: imagePastePluginKey,
    props: {
      handleDOMEvents: {
        paste: (view: EditorView, event: ClipboardEvent) => {
          const clipboardData = event.clipboardData
          if (!clipboardData) return false

          if (clipboardData.files && clipboardData.files.length > 0) {
            for (const file of clipboardData.files) {
              if (file.type.startsWith('image/')) {
                event.preventDefault()
                event.stopPropagation()
                handleFilePaste(file, imageInsertService, getOptions(), getContext())
                return true
              }
            }
          }

          if (clipboardData.items && clipboardData.items.length > 0) {
            for (const item of clipboardData.items) {
              if (item.type.startsWith('image/')) {
                event.preventDefault()
                event.stopPropagation()
                handleItemPaste(item, imageInsertService, getOptions(), getContext())
                return true
              }
            }
          }

          const html = clipboardData.getData('text/html')
          if (html) {
            const imgMatch = html.match(/<img[^>]+src="([^"]+)"/i)
            if (imgMatch && imgMatch[1]) {
              const imgUrl = imgMatch[1]
              if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:')) {
                event.preventDefault()
                event.stopPropagation()
                handleUrlPaste(imgUrl, imageInsertService, getOptions(), getContext())
                return true
              }
            }
          }

          return false
        },
      },
    },
  }))
}

async function handleFilePaste(
  file: File,
  service: ImageInsertService,
  options: ImageInsertOptions,
  context: ImageInsertContext
) {
  const hasPath = !!(file as any).path
  const source = hasPath
    ? await fileToImageSource(file)
    : await blobToImageSource(file)
  await service.insertWith(source, options, context)
}

async function handleItemPaste(
  item: DataTransferItem,
  service: ImageInsertService,
  options: ImageInsertOptions,
  context: ImageInsertContext
) {
  const blob = item.getAsFile()
  if (!blob) return
  const source = await blobToImageSource(blob)
  await service.insertWith(source, options, context)
}

async function handleUrlPaste(
  url: string,
  service: ImageInsertService,
  options: ImageInsertOptions,
  context: ImageInsertContext
) {
  const source = urlToImageSource(url)
  await service.insertWith(source, options, context)
}
