import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { ViewMode } from '@shared/types'

export class SetViewMode {
  constructor(
    private editorProvider: IEditorProvider,
    private eventBus: IEventBus
  ) {}

  execute(mode: ViewMode): void {
    this.editorProvider.setViewMode(mode)

    this.eventBus.emit('app:view-mode-changed', mode)
  }
}