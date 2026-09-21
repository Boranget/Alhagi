import type { CommandHandler } from '../types'
import { getDispatcher } from '../dispatcher'
import { getExecuteEditorCommandUseCase } from '@adapters/commandHandlers'

export function registerTableHandlers(dispatcher: ReturnType<typeof getDispatcher>): void {
  const executeEditorCommand = getExecuteEditorCommandUseCase()

  const handlers: Record<string, CommandHandler> = {
    'table.insert': () => {
      executeEditorCommand.execute('insertTable')
    },

    'table.insertRowAbove': () => {
      executeEditorCommand.execute('insertTableRowAbove')
    },

    'table.insertRowBelow': () => {
      executeEditorCommand.execute('insertTableRowBelow')
    },

    'table.insertColumnLeft': () => {
      executeEditorCommand.execute('insertTableColumnLeft')
    },

    'table.insertColumnRight': () => {
      executeEditorCommand.execute('insertTableColumnRight')
    },

    'table.deleteRow': () => {
      executeEditorCommand.execute('deleteTableRow')
    },

    'table.deleteColumn': () => {
      executeEditorCommand.execute('deleteTableColumn')
    },
  }

  dispatcher.registerBatch(handlers)
}
