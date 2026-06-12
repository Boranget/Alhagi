// ============================================================
// EditorCommands - 编辑器命令薄壳
// ============================================================
//
// 把 Milkdown 标准的 `crepe.editor.action(callCommand(commandKey, payload))`
// 模板抽象到一个 `runCommand` 私有方法，避免 28 个 try-catch 复制粘贴。
//
// 设计：
//   - 无参 milkdown 内置命令 → 一行调 `runCommand(commandKey)`
//   - 带参命令（heading level）→ 一行调 `runCommand(commandKey, payload)`
//   - 非 milkdown 命令（如 insertImage 直接 insert 字符串、表格 ctx 操作）
//     → 单独写实现，复用 `runAction` 处理 ctx 与错误
//   - 所有 catch 不再 silent：console.warn 含命令信息，方便定位

import { Crepe } from '@milkdown/crepe'
import { insert, callCommand } from '@milkdown/kit/utils'
import { undoCommand, redoCommand } from '@milkdown/plugin-history'
import {
  toggleEmphasisCommand,
  toggleStrongCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  wrapInHeadingCommand,
  createCodeBlockCommand,
} from '@milkdown/preset-commonmark'
import {
  insertTableCommand,
  toggleStrikethroughCommand,
} from '@milkdown/preset-gfm'
import { toggleTaskListCommand } from '@/commands/taskListCommands'
import { toggleHighlightCommand } from '@/plugins/inlineMarksPlugin'
import {
  insertTableRowAbove,
  insertTableRowBelow,
  deleteTableRow,
  insertTableColumnLeft,
  insertTableColumnRight,
  deleteTableColumn,
} from '@/commands/tableCommands'
import { editorStateCtx, editorViewCtx } from '@milkdown/kit/core'
import type { CmdKey } from '@milkdown/core'
import type { Ctx } from '@milkdown/ctx'

export class EditorCommands {
  private crepe: Crepe | null = null

  setCrepe(crepe: Crepe): void {
    this.crepe = crepe
  }

  /**
   * 执行 Milkdown 命令：包装 `editor.action(callCommand(key, payload))`，
   * 统一处理"未 ready 跳过"和"throw 时打 warn"。
   */
  private runCommand<T>(commandKey: CmdKey<T>, payload?: T): void {
    if (!this.crepe) return
    try {
      this.crepe.editor.action(callCommand(commandKey, payload))
    } catch (e) {
      console.warn(`[editor] command ${String(commandKey)} failed:`, e)
    }
  }

  /**
   * 执行需要直接拿 ctx 的自定义动作（如表格命令需要 state/view）。
   * 与 runCommand 一样统一错误处理。
   */
  private runAction(label: string, fn: (ctx: Ctx) => void): void {
    if (!this.crepe) return
    try {
      this.crepe.editor.action(fn)
    } catch (e) {
      console.warn(`[editor] action ${label} failed:`, e)
    }
  }

  // ---------- 历史 ----------
  undo(): void { this.runCommand(undoCommand.key) }
  redo(): void { this.runCommand(redoCommand.key) }

  // ---------- 行内格式 ----------
  toggleBold(): void          { this.runCommand(toggleStrongCommand.key) }
  toggleItalic(): void        { this.runCommand(toggleEmphasisCommand.key) }
  toggleStrikethrough(): void { this.runCommand(toggleStrikethroughCommand.key) }
  toggleInlineCode(): void    { this.runCommand(toggleInlineCodeCommand.key) }
  toggleLink(): void          { this.runCommand(toggleLinkCommand.key) }
  toggleHighlight(): void     { this.runCommand(toggleHighlightCommand.key) }

  // ---------- 段落/标题 ----------
  toggleHeading(level: number): void { this.runCommand(wrapInHeadingCommand.key, level) }
  toggleParagraph(): void            { this.runCommand(wrapInHeadingCommand.key, 0) }
  toggleBulletList(): void           { this.runCommand(wrapInBulletListCommand.key) }
  toggleOrderedList(): void          { this.runCommand(wrapInOrderedListCommand.key) }
  toggleTaskList(): void             { this.runCommand(toggleTaskListCommand.key) }
  toggleBlockQuote(): void           { this.runCommand(wrapInBlockquoteCommand.key) }
  toggleCodeBlock(): void            { this.runCommand(createCodeBlockCommand.key) }
  toggleCodeFence(): void            { this.runCommand(createCodeBlockCommand.key) }
  insertCodeBlock(): void            { this.runCommand(createCodeBlockCommand.key) }

  // ---------- 块级插入 ----------
  insertMathBlock(): void       { this.runAction('insertMathBlock', (ctx) => insert('\n$$\n\n$$\n', true)(ctx)) }
  insertHorizontalRule(): void  { this.runAction('insertHorizontalRule', (ctx) => insert('\n---\n', true)(ctx)) }

  // ---------- 表格 ----------
  insertTable(): void             { this.runCommand(insertTableCommand.key) }
  insertTableRowAbove(): void     { this.runAction('insertTableRowAbove', (ctx) => insertTableRowAbove(ctx.get(editorStateCtx), ctx.get(editorViewCtx))) }
  insertTableRowBelow(): void     { this.runAction('insertTableRowBelow', (ctx) => insertTableRowBelow(ctx.get(editorStateCtx), ctx.get(editorViewCtx))) }
  deleteTableRow(): void          { this.runAction('deleteTableRow', (ctx) => deleteTableRow(ctx.get(editorStateCtx), ctx.get(editorViewCtx))) }
  insertTableColumnLeft(): void   { this.runAction('insertTableColumnLeft', (ctx) => insertTableColumnLeft(ctx.get(editorStateCtx), ctx.get(editorViewCtx))) }
  insertTableColumnRight(): void  { this.runAction('insertTableColumnRight', (ctx) => insertTableColumnRight(ctx.get(editorStateCtx), ctx.get(editorViewCtx))) }
  deleteTableColumn(): void       { this.runAction('deleteTableColumn', (ctx) => deleteTableColumn(ctx.get(editorStateCtx), ctx.get(editorViewCtx))) }

  // ---------- 图片（自定义 markdown 插入，非 milkdown 命令） ----------
  insertImage(imageUrl: string, altText: string): void {
    this.runAction('insertImage', (ctx) => {
      const imageMarkdown = `![${altText || 'image'}](${imageUrl})`
      insert(imageMarkdown, true)(ctx)
    })
  }
}
