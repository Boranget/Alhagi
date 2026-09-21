import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetMarkdown } from '../GetMarkdown'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'

function createMockEditorProvider(): IEditorProvider {
  return {
    initWrapper: vi.fn(),
    detach: vi.fn(),
    destroy: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    createTab: vi.fn(),
    destroyTab: vi.fn(),
    switchTab: vi.fn(),
    hasTab: vi.fn(),
    getMarkdown: vi.fn().mockReturnValue('# Hello'),
    getHTML: vi.fn(),
    setViewMode: vi.fn(),
    setTabViewMode: vi.fn(),
    getViewMode: vi.fn(),
    scrollToHeading: vi.fn(),
    getHeadings: vi.fn(),
    getSelection: vi.fn(),
    getActiveEditor: vi.fn(),
    getView: vi.fn(),
    getCMSearchService: vi.fn(),
    updateTheme: vi.fn(),
    onContentChange: vi.fn(),
    onCursorChange: vi.fn(),
    getCachedContent: vi.fn(),
    setCachedContent: vi.fn(),
    clearCache: vi.fn(),
    init: vi.fn(),
    setCurrentTabId: vi.fn(),
    setMarkdown: vi.fn(),
  } as unknown as IEditorProvider
}

describe('GetMarkdown', () => {
  let getMarkdown: GetMarkdown
  let mockEditor: IEditorProvider

  beforeEach(() => {
    mockEditor = createMockEditorProvider()
    getMarkdown = new GetMarkdown(mockEditor)
  })

  it('should return markdown when editor is ready', () => {
    vi.mocked(mockEditor.isReady).mockReturnValue(true)
    vi.mocked(mockEditor.getMarkdown).mockReturnValue('# Title\n\nBody')

    const result = getMarkdown.execute()

    expect(result).toBe('# Title\n\nBody')
    expect(mockEditor.getMarkdown).toHaveBeenCalled()
  })

  it('should return empty string when editor is not ready', () => {
    vi.mocked(mockEditor.isReady).mockReturnValue(false)

    const result = getMarkdown.execute()

    expect(result).toBe('')
    expect(mockEditor.getMarkdown).not.toHaveBeenCalled()
  })
})
