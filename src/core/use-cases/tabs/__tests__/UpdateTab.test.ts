import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateTab } from '../UpdateTab'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { Tab } from '@core/entities/Tab'

const defaultEditorState = {
  cursor: { from: 0, to: 0 },
  scrollTop: 0,
  undoStack: [],
  redoStack: [],
}

function createMockTab(overrides: Partial<{ id: string; title: string; content: string }> = {}): Tab {
  return new Tab({
    id: overrides.id || 'tab-1',
    title: overrides.title || 'Test Tab',
    content: overrides.content || '',
    filePath: null,
    isDirty: false,
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'editor',
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null,
    crepe: { ...defaultEditorState },
    codeMirror: { ...defaultEditorState },
  })
}

describe('UpdateTab', () => {
  let updateTab: UpdateTab
  let mockTabRepository: ITabRepository
  let mockEventBus: IEventBus

  beforeEach(() => {
    mockTabRepository = {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getActiveTab: vi.fn(),
      getActiveTabId: vi.fn(),
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

    updateTab = new UpdateTab(mockTabRepository, mockEventBus)
  })

  it('should update the tab', async () => {
    const mockTab = createMockTab({ id: 'tab-1', title: 'Old Title' })
    vi.mocked(mockTabRepository.getById).mockReturnValue(mockTab)

    await updateTab.execute('tab-1', { title: 'New Title' })

    expect(mockTabRepository.update).toHaveBeenCalledWith('tab-1', { title: 'New Title' })
  })

  it('should emit tab:updated event', async () => {
    const mockTab = createMockTab({ id: 'tab-1', title: 'Old Title' })
    vi.mocked(mockTabRepository.getById).mockReturnValue(mockTab)

    await updateTab.execute('tab-1', { title: 'New Title' })

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:updated', {
      tabId: 'tab-1',
      updates: { title: 'New Title' },
    })
  })

  it('should do nothing when tab does not exist', async () => {
    vi.mocked(mockTabRepository.getById).mockReturnValue(undefined)

    await updateTab.execute('non-existent', { title: 'New Title' })

    expect(mockTabRepository.update).not.toHaveBeenCalled()
    expect(mockEventBus.emit).not.toHaveBeenCalled()
  })

  it('should handle partial updates', async () => {
    const mockTab = createMockTab({ id: 'tab-1', content: 'old content' })
    vi.mocked(mockTabRepository.getById).mockReturnValue(mockTab)

    await updateTab.execute('tab-1', { content: 'new content', isDirty: true })

    expect(mockTabRepository.update).toHaveBeenCalledWith('tab-1', {
      content: 'new content',
      isDirty: true,
    })
  })
})
