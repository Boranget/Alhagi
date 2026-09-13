import type { IEditorService } from '@core/interfaces/services/IEditorService'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'
import type { ViewMode } from '@shared/types'

export class SetViewMode {
  constructor(
    private editorService: IEditorService,
    private eventBus: IEventBus
  ) {}

  execute(mode: ViewMode): void {
    this.editorService.setViewMode(mode)

    this.eventBus.emit('app:view-mode-changed', mode)
  }
}
