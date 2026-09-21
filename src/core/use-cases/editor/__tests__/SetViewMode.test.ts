import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SetViewMode } from '../SetViewMode'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'

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
    getMarkdown: vi.fn(),
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

function createMockEventBus(): IEventBus {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    once: vi.fn(),
    subscribe: vi.fn(),
    clear: vi.fn(),
    hasListeners: vi.fn(),
    getListenerCount: vi.fn(),
  }
}

describe('SetViewMode', () => {
  let setViewMode: SetViewMode
  let mockEditor: IEditorProvider
  let mockEventBus: IEventBus

  beforeEach(() => {
    mockEditor = createMockEditorProvider()
    mockEventBus = createMockEventBus()
    setViewMode = new SetViewMode(mockEditor, mockEventBus)
  })

  it('should set view mode on editor', () => {
    setViewMode.execute('source')

    expect(mockEditor.setViewMode).toHaveBeenCalledWith('source')
  })

  it('should emit view mode changed event', () => {
    setViewMode.execute('wysiwyg')

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:view-mode-changed', 'wysiwyg')
  })

  it('should handle split mode', () => {
    setViewMode.execute('split')

    expect(mockEditor.setViewMode).toHaveBeenCalledWith('split')
    expect(mockEventBus.emit).toHaveBeenCalledWith('app:view-mode-changed', 'split')
  })
})
