import { eventBus, AppEvents } from '@/events/eventBus'
import { electronService } from '@/services/electron/ElectronService'

export class HelpCommandHandler {
  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }
    switch (type) {
      case 'help:shortcuts':
        eventBus.emit(AppEvents.SHOW_SHORTCUTS)
        return
      case 'help:commandPalette':
        eventBus.emit(AppEvents.SHOW_COMMAND_PALETTE)
        return
      case 'help:about':
        electronService.getAPI()?.executeMainCommand('help.about')
        return
      default:
        throw new Error(`Unknown help command: ${type}`)
    }
  }
}
