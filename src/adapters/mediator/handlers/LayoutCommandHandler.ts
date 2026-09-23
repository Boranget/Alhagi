import type { ICommandHandler } from '@core/domain/ports/IMediator'
import { useLayoutStore } from '@/stores/layout'

export class LayoutCommandHandler {
  private store = useLayoutStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type, ...params } = payload as { type: string; [k: string]: any }
    switch (type) {
      case 'layout:setSidebar':
        return this.store.setSidebar(params.show)
      case 'layout:setTabBar':
        return this.store.setTabBar(params.show)
      case 'layout:setStatusBar':
        return this.store.setStatusBar(params.show)
      case 'layout:toggleSidebar':
        return this.store.toggleSidebar()
      case 'layout:toggleTabBar':
        return this.store.toggleTabBar()
      case 'layout:toggleStatusBar':
        return this.store.toggleStatusBar()
      case 'layout:applyWindowMode':
        return this.store.applyWindowMode(params.mode)
      case 'layout:restoreDefaults':
        return this.store.restoreDefaults()
      case 'layout:setStickyNoteMode':
        return this.store.setStickyNoteMode(params.enabled)
      case 'layout:setImmersiveMode':
        return this.store.setImmersiveMode(params.enabled)
      default:
        throw new Error(`Unknown layout command: ${type}`)
    }
  }
}
