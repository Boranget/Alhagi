import type { IEditorService } from '@core/interfaces/services/IEditorService'

export class GetMarkdown {
  constructor(private editorService: IEditorService) {}

  execute(): string {
    if (!this.editorService.isReady()) {
      return ''
    }

    return this.editorService.getMarkdown()
  }
}
