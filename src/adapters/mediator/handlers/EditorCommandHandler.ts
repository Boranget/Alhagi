import { getExecuteEditorCommandUseCase } from '@adapters/commandHandlers'
import { eventBus, AppEvents } from '@/events/eventBus'
import type { EditorCommandType } from '@core/use-cases/editor/ExecuteEditorCommand'

const EDITOR_COMMAND_MAP: Record<string, EditorCommandType> = {
  'editor:format:bold': 'toggleBold',
  'editor:format:italic': 'toggleItalic',
  'editor:format:strikethrough': 'toggleStrikethrough',
  'editor:format:code': 'toggleInlineCode',
  'editor:format:link': 'toggleLink',
  'editor:format:highlight': 'toggleHighlight',
  'editor:paragraph:heading1': 'toggleHeading1',
  'editor:paragraph:heading2': 'toggleHeading2',
  'editor:paragraph:heading3': 'toggleHeading3',
  'editor:paragraph:paragraph': 'toggleParagraph',
  'editor:paragraph:quote': 'toggleBlockQuote',
  'editor:paragraph:bulletList': 'toggleBulletList',
  'editor:paragraph:orderedList': 'toggleOrderedList',
  'editor:paragraph:taskList': 'toggleTaskList',
  'editor:paragraph:codeBlock': 'toggleCodeFence',
  'editor:paragraph:mathBlock': 'insertMathBlock',
  'editor:paragraph:horizontalRule': 'insertHorizontalRule',
  'editor:table:insert': 'insertTable',
  'editor:table:insertRowAbove': 'insertTableRowAbove',
  'editor:table:insertRowBelow': 'insertTableRowBelow',
  'editor:table:insertColumnLeft': 'insertTableColumnLeft',
  'editor:table:insertColumnRight': 'insertTableColumnRight',
  'editor:table:deleteRow': 'deleteTableRow',
  'editor:table:deleteColumn': 'deleteTableColumn',
}

export class EditorCommandHandler {
  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }

    if (type === 'editor:format:image') {
      eventBus.emit(AppEvents.INSERT_IMAGE)
      return
    }

    const editorCommand = EDITOR_COMMAND_MAP[type]
    if (!editorCommand) {
      throw new Error(`Unknown editor command: ${type}`)
    }

    getExecuteEditorCommandUseCase().execute(editorCommand)
  }
}
