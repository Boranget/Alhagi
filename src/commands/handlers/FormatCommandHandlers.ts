import type { CommandHandler } from '../types'
import { getDispatcher } from '../dispatcher'
import { getExecuteEditorCommandUseCase } from '@adapters/commandHandlers'
import { eventBus, AppEvents } from '@/events/eventBus'

export function registerFormatHandlers(dispatcher: ReturnType<typeof getDispatcher>): void {
  const executeEditorCommand = getExecuteEditorCommandUseCase()

  const handlers: Record<string, CommandHandler> = {
    'format.bold': () => {
      executeEditorCommand.execute('toggleBold')
    },

    'format.italic': () => {
      executeEditorCommand.execute('toggleItalic')
    },

    'format.strikethrough': () => {
      executeEditorCommand.execute('toggleStrikethrough')
    },

    'format.code': () => {
      executeEditorCommand.execute('toggleInlineCode')
    },

    'format.link': () => {
      executeEditorCommand.execute('toggleLink')
    },

    'format.image': () => {
      eventBus.emit(AppEvents.INSERT_IMAGE)
    },

    'format.highlight': () => {
      executeEditorCommand.execute('toggleHighlight')
    },
  }

  dispatcher.registerBatch(handlers)
}
