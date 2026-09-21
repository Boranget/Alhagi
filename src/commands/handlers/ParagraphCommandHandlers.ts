import type { CommandHandler } from '../types'
import { getDispatcher } from '../dispatcher'
import { getExecuteEditorCommandUseCase } from '@adapters/commandHandlers'

export function registerParagraphHandlers(dispatcher: ReturnType<typeof getDispatcher>): void {
  const executeEditorCommand = getExecuteEditorCommandUseCase()

  const handlers: Record<string, CommandHandler> = {
    'paragraph.heading1': () => {
      executeEditorCommand.execute('toggleHeading1')
    },

    'paragraph.heading2': () => {
      executeEditorCommand.execute('toggleHeading2')
    },

    'paragraph.heading3': () => {
      executeEditorCommand.execute('toggleHeading3')
    },

    'paragraph.heading4': () => {
      executeEditorCommand.execute('toggleHeading4')
    },

    'paragraph.heading5': () => {
      executeEditorCommand.execute('toggleHeading5')
    },

    'paragraph.heading6': () => {
      executeEditorCommand.execute('toggleHeading6')
    },

    'paragraph.paragraph': () => {
      executeEditorCommand.execute('toggleParagraph')
    },

    'paragraph.quote': () => {
      executeEditorCommand.execute('toggleBlockQuote')
    },

    'paragraph.bulletList': () => {
      executeEditorCommand.execute('toggleBulletList')
    },

    'paragraph.orderedList': () => {
      executeEditorCommand.execute('toggleOrderedList')
    },

    'paragraph.taskList': () => {
      executeEditorCommand.execute('toggleTaskList')
    },

    'paragraph.codeBlock': () => {
      executeEditorCommand.execute('toggleCodeFence')
    },

    'paragraph.mathBlock': () => {
      executeEditorCommand.execute('insertMathBlock')
    },

    'paragraph.horizontalRule': () => {
      executeEditorCommand.execute('insertHorizontalRule')
    },
  }

  dispatcher.registerBatch(handlers)
}
