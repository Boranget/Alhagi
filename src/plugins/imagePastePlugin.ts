import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'
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

          console.log('[imagePaste] paste event', {
            fileCount: clipboardData.files?.length,
            itemCount: clipboardData.items?.length,
            hasHtml: !!clipboardData.getData('text/html'),
          })

          if (clipboardData.files && clipboardData.files.length > 0) {
            for (const file of clipboardData.files) {
              if (file.type.startsWith('image/')) {
                console.log('[imagePaste] file paste:', { name: file.name, type: file.type, size: file.size })
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
                console.log('[imagePaste] item paste:', { kind: item.kind, type: item.type })
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
              console.log('[imagePaste] html img paste:', imgUrl.substring(0, 80))
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
  console.log('[imagePaste] handleFilePaste:', { hasPath, name: file.name, type: file.type, path: (file as any).path })
  const source = hasPath
    ? await fileToImageSource(file)
    : await blobToImageSource(file)
  console.log('[imagePaste] source created:', { type: source.type, dataPrefix: source.data.substring(0, 40) })
  console.log('[imagePaste] options.mode:', options.mode)
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
