import type { IEditorService } from '@core/interfaces/services/IEditorService'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'

export class InitEditor {
  constructor(
    private editorService: IEditorService,
    private eventBus: IEventBus
  ) {}

  async execute(container: HTMLElement, content: string, tabId: string): Promise<void> {
    await this.editorService.init(container, content, tabId)

    this.eventBus.emit('app:editor:ready', { tabId })
  }
}
