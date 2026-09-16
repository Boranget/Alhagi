export type ImageInsertMode = 'keep-original' | 'copy'

export interface ImageInsertOptionsProps {
  mode: ImageInsertMode
  copyPath?: string
  preferRelativePath?: boolean
  applyToLocal?: boolean
  applyToRemote?: boolean
  escapeUrl?: boolean
}

export class ImageInsertOptions {
  public readonly mode: ImageInsertMode
  public readonly copyPath: string
  public readonly preferRelativePath: boolean
  public readonly applyToLocal: boolean
  public readonly applyToRemote: boolean
  public readonly escapeUrl: boolean

  constructor(props: ImageInsertOptionsProps) {
    this.mode = props.mode
    this.copyPath = props.copyPath || './'
    this.preferRelativePath = props.preferRelativePath ?? true
    this.applyToLocal = props.applyToLocal ?? true
    this.applyToRemote = props.applyToRemote ?? true
    this.escapeUrl = props.escapeUrl ?? false
  }

  static createDefault(): ImageInsertOptions {
    return new ImageInsertOptions({
      mode: 'keep-original',
      copyPath: './',
      preferRelativePath: true,
      applyToLocal: true,
      applyToRemote: true,
      escapeUrl: false,
    })
  }

  shouldApplyToSource(isLocal: boolean): boolean {
    if (isLocal) {
      return this.applyToLocal
    }
    return this.applyToRemote
  }

  toProps(): ImageInsertOptionsProps {
    return {
      mode: this.mode,
      copyPath: this.copyPath,
      preferRelativePath: this.preferRelativePath,
      applyToLocal: this.applyToLocal,
      applyToRemote: this.applyToRemote,
      escapeUrl: this.escapeUrl,
    }
  }
}
