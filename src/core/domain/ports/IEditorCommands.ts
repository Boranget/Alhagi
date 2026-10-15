// ============================================================
// IEditorCommands — 编辑器命令端口
// ============================================================
//
// 定义编辑器 UI 操作的契约（格式化、段落、表格等）。
// 由适配器经 IEditorCommandSource.getCommands() 供给。

export interface IEditorCommands {
  // 格式化命令
  toggleBold(): void
  toggleItalic(): void
  toggleStrikethrough(): void
  toggleInlineCode(): void
  toggleLink(): void
  toggleHighlight(): void

  // 段落命令
  toggleHeading(level: 1 | 2 | 3 | 4 | 5 | 6): void
  toggleParagraph(): void
  toggleBlockQuote(): void
  toggleBulletList(): void
  toggleOrderedList(): void
  toggleTaskList(): void
  toggleCodeFence(): void
  insertMathBlock(): void
  insertHorizontalRule(): void

  // 表格命令
  insertTable(): void
  insertTableRowAbove(): void
  insertTableRowBelow(): void
  insertTableColumnLeft(): void
  insertTableColumnRight(): void
  deleteTableRow(): void
  deleteTableColumn(): void
}
