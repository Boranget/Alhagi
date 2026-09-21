import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InitEditor } from '../InitEditor'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'

describe('InitEditor', () => {
  let initEditor: InitEditor
  let mockEditorProvider: IEditorProvider
  let mockEventBus: IEventBus
  let mockTabRepository: ITabRepository
  let container: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()

    mockEditorProvider = {
      init: vi.fn().mockResolvedValue(undefined),
      initWrapper: vi.fn().mockResolvedValue(undefined),
      detach: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockReturnValue(true),
      createTab: vi.fn().mockResolvedValue(undefined),
      destroyTab: vi.fn().mockResolvedValue(undefined),
      switchTab: vi.fn(),
      hasTab: vi.fn().mockReturnValue(false),
      getMarkdown: vi.fn().mockReturnValue(''),
      getHTML: vi.fn().mockReturnValue(''),
      setViewMode: vi.fn(),
      setTabViewMode: vi.fn(),
      getViewMode: vi.fn().mockReturnValue('wysiwyg'),
      scrollToHeading: vi.fn(),
      onContentChange: vi.fn().mockReturnValue(vi.fn()),
      onCursorChange: vi.fn().mockReturnValue(vi.fn()),
      getSelection: vi.fn().mockReturnValue(null),
      getHeadings: vi.fn().mockReturnValue([]),
      getActiveEditor: vi.fn().mockReturnValue('crepe'),
      getView: vi.fn().mockReturnValue(null),
      getCMSearchService: vi.fn().mockReturnValue(null),
      updateTheme: vi.fn().mockResolvedValue(undefined),
      setCurrentTabId: vi.fn(),
      setMarkdown: vi.fn().mockResolvedValue(undefined),
      getCachedContent: vi.fn().mockReturnValue(undefined),
      setCachedContent: vi.fn(),
      clearCache: vi.fn(),
      focus: vi.fn(),
      insertAtCursor: vi.fn(),
      scrollToPosition: vi.fn(),
      getInstance: vi.fn(),
    } as any

    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      subscribe: vi.fn(),
      clear: vi.fn(),
      hasListeners: vi.fn(),
      getListenerCount: vi.fn(),
    }

    mockTabRepository = {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getActiveTab: vi.fn(),
      getActiveTabId: vi.fn().mockReturnValue('tab-1'),
      setActiveTab: vi.fn(),
      getDirtyTabs: vi.fn(),
      markDirty: vi.fn(),
      markClean: vi.fn(),
      setViewMode: vi.fn(),
      setSplitRatio: vi.fn(),
      findTabByFilePath: vi.fn(),
      getTabCount: vi.fn(),
      getTabOrder: vi.fn(),
      hasOpenFiles: vi.fn(),
      insert: vi.fn(),
    }

    container = document.createElement('div')
    initEditor = new InitEditor(mockEditorProvider, mockEventBus, mockTabRepository)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create tab if not exists and switch to it', async () => {
    vi.mocked(mockEditorProvider.hasTab).mockReturnValue(false)

    await initEditor.execute(container, '# Hello', 'tab-1')

    expect(mockEditorProvider.hasTab).toHaveBeenCalledWith('tab-1')
    expect(mockEditorProvider.createTab).toHaveBeenCalledWith('tab-1', '# Hello')
    expect(mockEditorProvider.switchTab).toHaveBeenCalledWith('tab-1')
  })

  it('should skip createTab if tab already exists', async () => {
    vi.mocked(mockEditorProvider.hasTab).mockReturnValue(true)

    await initEditor.execute(container, '# Hello', 'tab-1')

    expect(mockEditorProvider.hasTab).toHaveBeenCalledWith('tab-1')
    expect(mockEditorProvider.createTab).not.toHaveBeenCalled()
    expect(mockEditorProvider.switchTab).toHaveBeenCalledWith('tab-1')
  })

  it('should subscribe to content changes', async () => {
    await initEditor.execute(container, '', 'tab-1')

    expect(mockEditorProvider.onContentChange).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should emit editor:ready event after init', async () => {
    await initEditor.execute(container, '', 'tab-1')

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:editor:ready', { tabId: 'tab-1' })
  })

  it('should update tab repository when content changes', async () => {
    const contentChangeHandler = vi.fn()
    vi.mocked(mockEditorProvider.onContentChange).mockReturnValue(contentChangeHandler)

    await initEditor.execute(container, '', 'tab-1')

    const handler = vi.mocked(mockEditorProvider.onContentChange).mock.calls[0][0] as (md: string) => void
    handler('# Updated')

    expect(mockTabRepository.getActiveTabId).toHaveBeenCalled()
    expect(mockTabRepository.update).toHaveBeenCalledWith('tab-1', {
      content: '# Updated',
      isDirty: true,
      lastModified: expect.any(Number),
    })
  })

  it('should emit content:changed event on content change', async () => {
    vi.mocked(mockEditorProvider.onContentChange).mockReturnValue(vi.fn())

    await initEditor.execute(container, '', 'tab-1')

    const handler = vi.mocked(mockEditorProvider.onContentChange).mock.calls[0][0] as (md: string) => void
    handler('# Changed')

    expect(mockEventBus.emit).toHaveBeenCalledWith('editor:content:changed', {
      content: '# Changed',
      tabId: 'tab-1',
    })
  })

  it('should skip update if no active tab on content change', async () => {
    vi.mocked(mockTabRepository.getActiveTabId).mockReturnValue(null)
    vi.mocked(mockEditorProvider.onContentChange).mockReturnValue(vi.fn())

    await initEditor.execute(container, '', 'tab-1')

    const handler = vi.mocked(mockEditorProvider.onContentChange).mock.calls[0][0] as (md: string) => void
    handler('# Changed')

    expect(mockTabRepository.update).not.toHaveBeenCalled()
  })

  it('should unsubscribe previous handler on re-init', async () => {
    const unsub1 = vi.fn()
    const unsub2 = vi.fn()
    vi.mocked(mockEditorProvider.onContentChange)
      .mockReturnValueOnce(unsub1)
      .mockReturnValueOnce(unsub2)

    await initEditor.execute(container, '', 'tab-1')
    await initEditor.execute(container, '', 'tab-2')

    expect(unsub1).toHaveBeenCalled()
  })

  it('should handle default content parameter', async () => {
    await initEditor.execute(container, undefined as any, 'tab-1')

    expect(mockEditorProvider.createTab).toHaveBeenCalledWith('tab-1', '')
  })
})
