export type ImageSourceType = 'file' | 'clipboard' | 'url'

export interface ImageSourceProps {
  type: ImageSourceType
  data: string
  fileName?: string
  mimeType?: string
  width?: number
  height?: number
}

export class ImageSource {
  public readonly type: ImageSourceType
  public readonly data: string
  public readonly fileName: string
  public readonly mimeType: string
  public readonly width?: number
  public readonly height?: number

  constructor(props: ImageSourceProps) {
    this.type = props.type
    this.data = props.data
    this.fileName = props.fileName || this.generateFileName()
    this.mimeType = props.mimeType || 'image/png'
    this.width = props.width
    this.height = props.height
  }

  private generateFileName(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `image-${timestamp}-${random}.png`
  }

  isLocalFile(): boolean {
    return this.type === 'file' && !this.data.startsWith('http')
  }

  isRemoteUrl(): boolean {
    return this.type === 'url' || (this.type === 'file' && this.data.startsWith('http'))
  }

  isClipboardImage(): boolean {
    return this.type === 'clipboard'
  }

  toProps(): ImageSourceProps {
    return {
      type: this.type,
      data: this.data,
      fileName: this.fileName,
      mimeType: this.mimeType,
      width: this.width,
      height: this.height,
    }
  }
}
