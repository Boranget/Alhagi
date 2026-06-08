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

export class EditorCommands {
  private crepe: Crepe | null = null
  private isInitialized = false

  setCrepe(crepe: Crepe): void {
    this.crepe = crepe
    this.isInitialized = true
  }

  undo(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(undoCommand.key))
    } catch {
      // Silent fail
    }
  }

  redo(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(redoCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleBold(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleStrongCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleItalic(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleEmphasisCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleStrikethrough(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleStrikethroughCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleInlineCode(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleInlineCodeCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleLink(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleLinkCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleHeading(level: number): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInHeadingCommand.key, level))
    } catch {
      // Silent fail
    }
  }

  toggleParagraph(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInHeadingCommand.key, 0))
    } catch (error) {
      console.error('[EditorCommands] toggleParagraph failed:', error)
    }
  }

  toggleHighlight(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(toggleHighlightCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleBulletList(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInBulletListCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleOrderedList(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInOrderedListCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleTaskList(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInBulletListCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleBlockQuote(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(wrapInBlockquoteCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleCodeBlock(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(createCodeBlockCommand.key))
    } catch {
      // Silent fail
    }
  }

  toggleCodeFence(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(createCodeBlockCommand.key))
    } catch {
      // Silent fail
    }
  }

  insertCodeBlock(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(createCodeBlockCommand.key))
    } catch {
      // Silent fail
    }
  }

  insertMathBlock(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(insert('\n$$\n\n$$\n', true))
    } catch {
      // Silent fail
    }
  }

  insertHorizontalRule(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(insert('\n---\n', true))
    } catch {
      // Silent fail
    }
  }

  insertTable(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action(callCommand(insertTableCommand.key))
    } catch {
      // Silent fail
    }
  }

  insertTableRowAbove(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        insertTableRowAbove(state, view)
      })
    } catch {
      // Silent fail
    }
  }

  insertTableRowBelow(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        insertTableRowBelow(state, view)
      })
    } catch {
      // Silent fail
    }
  }

  deleteTableRow(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        deleteTableRow(state, view)
      })
    } catch {
      // Silent fail
    }
  }

  insertTableColumnLeft(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        insertTableColumnLeft(state, view)
      })
    } catch {
      // Silent fail
    }
  }

  insertTableColumnRight(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        insertTableColumnRight(state, view)
      })
    } catch {
      // Silent fail
    }
  }

  deleteTableColumn(): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      this.crepe.editor.action((ctx) => {
        const state = ctx.get(editorStateCtx)
        const view = ctx.get(editorViewCtx)
        deleteTableColumn(state, view)
      })
    } catch {
      // Silent fail
    }
  }

  insertImage(imageUrl: string, altText: string): void {
    if (!this.crepe || !this.isInitialized) return
    try {
      const imageMarkdown = `![${altText || 'image'}](${imageUrl})`
      this.crepe.editor.action(insert(imageMarkdown, true))
    } catch {
      // Silent fail
    }
  }
}