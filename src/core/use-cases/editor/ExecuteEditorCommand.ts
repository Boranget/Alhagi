// ============================================================
// ExecuteEditorCommand — 执行编辑器命令用例
// ============================================================
//
// 封装编辑器 UI 操作（格式化、段落、表格等）。
// 通过 IEditorCommands 接口执行，不依赖具体编辑器实现。

import type { IEditorCommands } from '@core/domain/ports/IEditorCommands'

export type EditorCommandType =
  | 'toggleBold'
  | 'toggleItalic'
  | 'toggleStrikethrough'
  | 'toggleInlineCode'
  | 'toggleLink'
  | 'toggleHighlight'
  | 'toggleHeading1'
  | 'toggleHeading2'
  | 'toggleHeading3'
  | 'toggleHeading4'
  | 'toggleHeading5'
  | 'toggleHeading6'
  | 'toggleParagraph'
  | 'toggleBlockQuote'
  | 'toggleBulletList'
  | 'toggleOrderedList'
  | 'toggleTaskList'
  | 'toggleCodeFence'
  | 'insertMathBlock'
  | 'insertHorizontalRule'
  | 'insertTable'
  | 'insertTableRowAbove'
  | 'insertTableRowBelow'
  | 'insertTableColumnLeft'
  | 'insertTableColumnRight'
  | 'deleteTableRow'
  | 'deleteTableColumn'

export class ExecuteEditorCommand {
  constructor(private editorCommands: IEditorCommands) {}

  execute(command: EditorCommandType): void {
    switch (command) {
      case 'toggleBold':
        this.editorCommands.toggleBold()
        break
      case 'toggleItalic':
        this.editorCommands.toggleItalic()
        break
      case 'toggleStrikethrough':
        this.editorCommands.toggleStrikethrough()
        break
      case 'toggleInlineCode':
        this.editorCommands.toggleInlineCode()
        break
      case 'toggleLink':
        this.editorCommands.toggleLink()
        break
      case 'toggleHighlight':
        this.editorCommands.toggleHighlight()
        break
      case 'toggleHeading1':
        this.editorCommands.toggleHeading(1)
        break
      case 'toggleHeading2':
        this.editorCommands.toggleHeading(2)
        break
      case 'toggleHeading3':
        this.editorCommands.toggleHeading(3)
        break
      case 'toggleHeading4':
        this.editorCommands.toggleHeading(4)
        break
      case 'toggleHeading5':
        this.editorCommands.toggleHeading(5)
        break
      case 'toggleHeading6':
        this.editorCommands.toggleHeading(6)
        break
      case 'toggleParagraph':
        this.editorCommands.toggleParagraph()
        break
      case 'toggleBlockQuote':
        this.editorCommands.toggleBlockQuote()
        break
      case 'toggleBulletList':
        this.editorCommands.toggleBulletList()
        break
      case 'toggleOrderedList':
        this.editorCommands.toggleOrderedList()
        break
      case 'toggleTaskList':
        this.editorCommands.toggleTaskList()
        break
      case 'toggleCodeFence':
        this.editorCommands.toggleCodeFence()
        break
      case 'insertMathBlock':
        this.editorCommands.insertMathBlock()
        break
      case 'insertHorizontalRule':
        this.editorCommands.insertHorizontalRule()
        break
      case 'insertTable':
        this.editorCommands.insertTable()
        break
      case 'insertTableRowAbove':
        this.editorCommands.insertTableRowAbove()
        break
      case 'insertTableRowBelow':
        this.editorCommands.insertTableRowBelow()
        break
      case 'insertTableColumnLeft':
        this.editorCommands.insertTableColumnLeft()
        break
      case 'insertTableColumnRight':
        this.editorCommands.insertTableColumnRight()
        break
      case 'deleteTableRow':
        this.editorCommands.deleteTableRow()
        break
      case 'deleteTableColumn':
        this.editorCommands.deleteTableColumn()
        break
    }
  }
}
