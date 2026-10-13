import { getExecuteEditorCommandUseCase } from '@adapters/commandHandlers'
import type { EditorCommandType } from '@core/use-cases/editor/ExecuteEditorCommand'
import { getImageInsertService, getImageInsertOptions, getImageInsertContext } from '@infrastructure/di/Container'
import { fileToImageSource } from '@/services/image/ImagePasteHandler'

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

function pickAndInsertImage(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const source = await fileToImageSource(file)
      const service = getImageInsertService()
      const options = getImageInsertOptions()
      const context = getImageInsertContext()
      await service.insertWith(source, options, context)
    } catch (error) {
      console.error('[EditorCommandHandler] insert image failed:', error)
    }
  }
  input.click()
}

export class EditorCommandHandler {
  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }

    if (type === 'editor:format:image') {
      pickAndInsertImage()
      return
    }

    const editorCommand = EDITOR_COMMAND_MAP[type]
    if (!editorCommand) {
      throw new Error(`Unknown editor command: ${type}`)
    }

    getExecuteEditorCommandUseCase().execute(editorCommand)
  }
}
