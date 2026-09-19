import { ImageSource } from '@core/entities/image/ImageSource'

export function extractFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop()
    return filename || `image-${Date.now()}.png`
  } catch {
    return `image-${Date.now()}.png`
  }
}

export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

export async function fileToImageSource(file: File): Promise<ImageSource> {
  const arrayBuffer = await file.arrayBuffer()
  const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer))
  return new ImageSource({
    type: 'file',
    data: `data:${file.type};base64,${base64}`,
    fileName: file.name,
    mimeType: file.type,
  })
}

export async function blobToImageSource(blob: Blob, fallbackName?: string): Promise<ImageSource> {
  const arrayBuffer = await blob.arrayBuffer()
  const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer))
  // Blob doesn't have name property, only File does
  const fileName = fallbackName || `image-${Date.now()}.png`
  return new ImageSource({
    type: 'clipboard',
    data: `data:${blob.type};base64,${base64}`,
    fileName,
    mimeType: blob.type,
  })
}

export function urlToImageSource(url: string): ImageSource {
  return new ImageSource({
    type: 'url',
    data: url,
    fileName: extractFileNameFromUrl(url),
  })
}
