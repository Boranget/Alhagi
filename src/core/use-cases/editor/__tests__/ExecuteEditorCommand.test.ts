import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExecuteEditorCommand } from '../ExecuteEditorCommand'
import type { IEditorCommands } from '@core/domain/ports/IEditorCommands'

function createMockEditorCommands(): IEditorCommands {
  return {
    toggleBold: vi.fn(),
    toggleItalic: vi.fn(),
    toggleStrikethrough: vi.fn(),
    toggleInlineCode: vi.fn(),
    toggleLink: vi.fn(),
    toggleHighlight: vi.fn(),
    toggleHeading: vi.fn(),
    toggleParagraph: vi.fn(),
    toggleBlockQuote: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleOrderedList: vi.fn(),
    toggleTaskList: vi.fn(),
    toggleCodeFence: vi.fn(),
    insertMathBlock: vi.fn(),
    insertHorizontalRule: vi.fn(),
    insertTable: vi.fn(),
    insertTableRowAbove: vi.fn(),
    insertTableRowBelow: vi.fn(),
    insertTableColumnLeft: vi.fn(),
    insertTableColumnRight: vi.fn(),
    deleteTableRow: vi.fn(),
    deleteTableColumn: vi.fn(),
  }
}

describe('ExecuteEditorCommand', () => {
  let useCase: ExecuteEditorCommand
  let mockCommands: IEditorCommands

  beforeEach(() => {
    mockCommands = createMockEditorCommands()
    useCase = new ExecuteEditorCommand(mockCommands)
  })

  it('should execute toggleBold', () => {
    useCase.execute('toggleBold')
    expect(mockCommands.toggleBold).toHaveBeenCalled()
  })

  it('should execute toggleItalic', () => {
    useCase.execute('toggleItalic')
    expect(mockCommands.toggleItalic).toHaveBeenCalled()
  })

  it('should execute toggleStrikethrough', () => {
    useCase.execute('toggleStrikethrough')
    expect(mockCommands.toggleStrikethrough).toHaveBeenCalled()
  })

  it('should execute toggleInlineCode', () => {
    useCase.execute('toggleInlineCode')
    expect(mockCommands.toggleInlineCode).toHaveBeenCalled()
  })

  it('should execute toggleLink', () => {
    useCase.execute('toggleLink')
    expect(mockCommands.toggleLink).toHaveBeenCalled()
  })

  it('should execute toggleHighlight', () => {
    useCase.execute('toggleHighlight')
    expect(mockCommands.toggleHighlight).toHaveBeenCalled()
  })

  it('should execute toggleHeading1', () => {
    useCase.execute('toggleHeading1')
    expect(mockCommands.toggleHeading).toHaveBeenCalledWith(1)
  })

  it('should execute toggleHeading2', () => {
    useCase.execute('toggleHeading2')
    expect(mockCommands.toggleHeading).toHaveBeenCalledWith(2)
  })

  it('should execute toggleHeading3', () => {
    useCase.execute('toggleHeading3')
    expect(mockCommands.toggleHeading).toHaveBeenCalledWith(3)
  })

  it('should execute toggleParagraph', () => {
    useCase.execute('toggleParagraph')
    expect(mockCommands.toggleParagraph).toHaveBeenCalled()
  })

  it('should execute toggleBlockQuote', () => {
    useCase.execute('toggleBlockQuote')
    expect(mockCommands.toggleBlockQuote).toHaveBeenCalled()
  })

  it('should execute toggleBulletList', () => {
    useCase.execute('toggleBulletList')
    expect(mockCommands.toggleBulletList).toHaveBeenCalled()
  })

  it('should execute toggleOrderedList', () => {
    useCase.execute('toggleOrderedList')
    expect(mockCommands.toggleOrderedList).toHaveBeenCalled()
  })

  it('should execute toggleTaskList', () => {
    useCase.execute('toggleTaskList')
    expect(mockCommands.toggleTaskList).toHaveBeenCalled()
  })

  it('should execute toggleCodeFence', () => {
    useCase.execute('toggleCodeFence')
    expect(mockCommands.toggleCodeFence).toHaveBeenCalled()
  })

  it('should execute insertMathBlock', () => {
    useCase.execute('insertMathBlock')
    expect(mockCommands.insertMathBlock).toHaveBeenCalled()
  })

  it('should execute insertHorizontalRule', () => {
    useCase.execute('insertHorizontalRule')
    expect(mockCommands.insertHorizontalRule).toHaveBeenCalled()
  })

  it('should execute insertTable', () => {
    useCase.execute('insertTable')
    expect(mockCommands.insertTable).toHaveBeenCalled()
  })

  it('should execute insertTableRowAbove', () => {
    useCase.execute('insertTableRowAbove')
    expect(mockCommands.insertTableRowAbove).toHaveBeenCalled()
  })

  it('should execute insertTableRowBelow', () => {
    useCase.execute('insertTableRowBelow')
    expect(mockCommands.insertTableRowBelow).toHaveBeenCalled()
  })

  it('should execute insertTableColumnLeft', () => {
    useCase.execute('insertTableColumnLeft')
    expect(mockCommands.insertTableColumnLeft).toHaveBeenCalled()
  })

  it('should execute insertTableColumnRight', () => {
    useCase.execute('insertTableColumnRight')
    expect(mockCommands.insertTableColumnRight).toHaveBeenCalled()
  })

  it('should execute deleteTableRow', () => {
    useCase.execute('deleteTableRow')
    expect(mockCommands.deleteTableRow).toHaveBeenCalled()
  })

  it('should execute deleteTableColumn', () => {
    useCase.execute('deleteTableColumn')
    expect(mockCommands.deleteTableColumn).toHaveBeenCalled()
  })
})
