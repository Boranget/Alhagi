import type { ICommandHandler } from '@core/domain/ports/IMediator'
import { useViewModeStore } from '@/stores/viewMode'
import { getToggleTypewriterModeUseCase, getToggleFocusModeUseCase } from '@adapters/commandHandlers'

/** 命令 payload 在中介者边界是动态的；按各 case 实际消费的字段声明 */
interface ViewModeCommandParams {
  enabled: boolean
}

export class ViewModeCommandHandler {
  private store = useViewModeStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type, ...params } = payload as { type: string } & ViewModeCommandParams
    switch (type) {
      case 'view:setTypewriterMode':
        return this.store.setTypewriterMode(params.enabled)
      case 'view:setFocusMode':
        return this.store.setFocusMode(params.enabled)
      case 'view:toggleTypewriterMode': {
        const newState = !this.store.typewriterMode
        getToggleTypewriterModeUseCase().applyState(newState)
        this.store.setTypewriterMode(newState)
        return newState
      }
      case 'view:toggleFocusMode': {
        const newState = !this.store.focusMode
        getToggleFocusModeUseCase().applyState(newState)
        this.store.setFocusMode(newState)
        return newState
      }
      default:
        throw new Error(`Unknown viewMode command: ${type}`)
    }
  }
}
