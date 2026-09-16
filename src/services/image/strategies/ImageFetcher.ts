export interface FetchedImage {
  base64: string
  mimeType: string
}

export class ImageFetcher {
  async fetch(url: string): Promise<FetchedImage> {
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

    return {
      base64: btoa(binary),
      mimeType: contentType,
    }
  }
}
