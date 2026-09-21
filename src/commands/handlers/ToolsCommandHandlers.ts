import type { CommandHandler } from '../types'
import { getDispatcher } from '../dispatcher'
import { eventBus, AppEvents } from '@/events/eventBus'

export function registerToolsHandlers(dispatcher: ReturnType<typeof getDispatcher>): void {
  const handlers: Record<string, CommandHandler> = {
    'tools.preferences': () => {
      eventBus.emit(AppEvents.OPEN_SETTINGS)
    },

    'tools.export': () => {
      eventBus.emit(AppEvents.EXPORT, { format: 'markdown' })
    },

    'tools.exportHTML': () => {
      eventBus.emit(AppEvents.EXPORT, { format: 'html' })
    },

    'tools.exportPDF': () => {
      eventBus.emit(AppEvents.EXPORT, { format: 'pdf' })
    },

    'tools.captureScreen': () => {
      eventBus.emit(AppEvents.CAPTURE_SCREEN)
    },
  }

  dispatcher.registerBatch(handlers)
}
