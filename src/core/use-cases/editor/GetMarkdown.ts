import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'

export class GetMarkdown {
  constructor(private editorProvider: IEditorProvider) {}

  execute(): string {
    if (!this.editorProvider.isReady()) {
      return ''
    }

    return this.editorProvider.getMarkdown()
  }
}