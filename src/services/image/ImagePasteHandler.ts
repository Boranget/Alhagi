import { ImageSource } from '@core/entities/image/ImageSource'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'

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

function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

export { extractFileNameFromUrl, uint8ArrayToBase64 }
