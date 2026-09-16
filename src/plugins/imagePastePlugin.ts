import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'
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
          console.log('[ImagePastePlugin] paste event intercepted')
          const clipboardData = event.clipboardData
          if (!clipboardData) return false

          console.log('[ImagePastePlugin] types:', Array.from(clipboardData.types), 'files:', clipboardData.files?.length)

          // Check for image files
          if (clipboardData.files && clipboardData.files.length > 0) {
            for (const file of clipboardData.files) {
              if (file.type.startsWith('image/')) {
                console.log('[ImagePastePlugin] Found image file, handling...')
                event.preventDefault()
                event.stopPropagation()
                handleFilePaste(file, imageInsertService, getOptions(), getContext())
                return true
              }
            }
          }

          // Check for image items
          if (clipboardData.items && clipboardData.items.length > 0) {
            for (const item of clipboardData.items) {
              if (item.type.startsWith('image/')) {
                console.log('[ImagePastePlugin] Found image item, handling...')
                event.preventDefault()
                event.stopPropagation()
                handleItemPaste(item, imageInsertService, getOptions(), getContext())
                return true
              }
            }
          }

          // Check for HTML with <img> tags (images from web pages)
          const html = clipboardData.getData('text/html')
          if (html) {
            const imgMatch = html.match(/<img[^>]+src="([^"]+)"/i)
            if (imgMatch && imgMatch[1]) {
              const imgUrl = imgMatch[1]
              if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:')) {
                console.log('[ImagePastePlugin] Found image URL from HTML:', imgUrl.substring(0, 100))
                event.preventDefault()
                event.stopPropagation()
                handleUrlPaste(imgUrl, imageInsertService, getOptions(), getContext())
                return true
              }
            }
          }

          console.log('[ImagePastePlugin] No image found, letting editor handle it')
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
  const { ImageSource } = await import('@core/entities/image/ImageSource')

  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  const base64 = btoa(binary)

  const source = new ImageSource({
    type: 'file',
    data: `data:${file.type};base64,${base64}`,
    fileName: file.name,
    mimeType: file.type,
  })

  console.log('[ImagePastePlugin] insertWith context:', { currentFileDir: context.currentFileDir })
  const result = await service.insertWith(source, options, context)
  console.log('[ImagePastePlugin] insert result:', result)
}

async function handleItemPaste(
  item: DataTransferItem,
  service: ImageInsertService,
  options: ImageInsertOptions,
  context: ImageInsertContext
) {
  const blob = item.getAsFile()
  if (!blob) return

  const { ImageSource } = await import('@core/entities/image/ImageSource')

  const arrayBuffer = await blob.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  const base64 = btoa(binary)

  const source = new ImageSource({
    type: 'clipboard',
    data: `data:${blob.type};base64,${base64}`,
    fileName: blob.name || `image-${Date.now()}.png`,
    mimeType: blob.type,
  })

  const result = await service.insertWith(source, options, context)
  console.log('[ImagePastePlugin] insert result:', result)
}

async function handleUrlPaste(
  url: string,
  service: ImageInsertService,
  options: ImageInsertOptions,
  context: ImageInsertContext
) {
  const { ImageSource } = await import('@core/entities/image/ImageSource')

  const source = new ImageSource({
    type: 'url',
    data: url,
    fileName: extractFileNameFromUrl(url),
  })

  const result = await service.insertWith(source, options, context)
  console.log('[ImagePastePlugin] insert result:', result)
}

function extractFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop()
    return filename || `image-${Date.now()}.png`
  } catch {
    return `image-${Date.now()}.png`
  }
}
