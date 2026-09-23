import type { ICommandHandler } from '@core/domain/ports/IMediator'
import { useViewModeStore } from '@/stores/viewMode'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import { ViewModeGateway } from '@adapters/gateways/ViewModeGateway'
import { ScrollServiceGateway } from '@adapters/gateways/ScrollServiceGateway'
import { ToggleTypewriterMode } from '@core/use-cases/editor/ToggleTypewriterMode'
import { ToggleFocusMode } from '@core/use-cases/editor/ToggleFocusMode'

export class ViewModeCommandHandler {
  private store = useViewModeStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type, ...params } = payload as { type: string; [k: string]: any }
    switch (type) {
      case 'view:setTypewriterMode':
        return this.store.setTypewriterMode(params.enabled)
      case 'view:setFocusMode':
        return this.store.setFocusMode(params.enabled)
      case 'view:toggleTypewriterMode': {
        const gateway = getEditorServiceGateway()
        const scrollService = new ScrollServiceGateway(gateway)
        const viewModeGateway = new ViewModeGateway(gateway)
        const useCase = new ToggleTypewriterMode(scrollService, viewModeGateway)
        const newState = !this.store.typewriterMode
        useCase.applyState(newState)
        this.store.setTypewriterMode(newState)
        return newState
      }
      case 'view:toggleFocusMode': {
        const gateway = getEditorServiceGateway()
        const viewModeGateway = new ViewModeGateway(gateway)
        const useCase = new ToggleFocusMode(viewModeGateway)
        const newState = !this.store.focusMode
        useCase.applyState(newState)
        this.store.setFocusMode(newState)
        return newState
      }
      default:
        throw new Error(`Unknown viewMode command: ${type}`)
    }
  }
}
