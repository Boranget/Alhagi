export interface ImageInsertResultProps {
  success: boolean
  imageUrl?: string
  relativePath?: string
  error?: string
}

export class ImageInsertResult {
  public readonly success: boolean
  public readonly imageUrl: string | undefined
  public readonly relativePath?: string
  public readonly error?: string

  constructor(props: ImageInsertResultProps) {
    this.success = props.success
    this.imageUrl = props.imageUrl
    this.relativePath = props.relativePath
    this.error = props.error
  }

  static success(imageUrl: string, relativePath?: string): ImageInsertResult {
    return new ImageInsertResult({
      success: true,
      imageUrl,
      relativePath,
    })
  }

  static failure(error: string): ImageInsertResult {
    return new ImageInsertResult({
      success: false,
      error,
    })
  }

  toProps(): ImageInsertResultProps {
    return {
      success: this.success,
      imageUrl: this.imageUrl,
      relativePath: this.relativePath,
      error: this.error,
    }
  }
}
