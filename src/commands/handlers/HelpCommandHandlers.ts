import type { CommandHandler } from '../types'
import { getDispatcher } from '../dispatcher'
import { eventBus, AppEvents } from '@/events/eventBus'
import { electronService } from '@/services/electron/ElectronService'

export function registerHelpHandlers(dispatcher: ReturnType<typeof getDispatcher>): void {
  const handlers: Record<string, CommandHandler> = {
    'help.shortcuts': () => {
      eventBus.emit(AppEvents.SHOW_SHORTCUTS)
    },

    'help.commandPalette': () => {
      eventBus.emit(AppEvents.SHOW_COMMAND_PALETTE)
    },

    'help.about': () => {
      electronService.getAPI()?.executeMainCommand('help.about')
    },
  }

  dispatcher.registerBatch(handlers)
}
