import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateTab } from '../CreateTab'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { Tab } from '@core/entities/Tab'

const defaultEditorState = {
  cursor: { from: 0, to: 0 },
  scrollTop: 0,
  undoStack: [],
  redoStack: [],
}

function createMockTab(overrides: Partial<{ id: string; title: string; filePath: string | null }> = {}): Tab {
  return new Tab({
    id: overrides.id || 'tab-1',
    title: overrides.title || 'Test Tab',
    filePath: overrides.filePath ?? null,
    content: '',
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

describe('CreateTab', () => {
  let createTab: CreateTab
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
      hasOpenFiles: vi.fn(),
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

    createTab = new CreateTab(mockTabRepository, mockEventBus)
  })

  it('should create a new tab', async () => {
    const mockTab = createMockTab({ title: 'Test Tab' })
    vi.mocked(mockTabRepository.create).mockReturnValue(mockTab)

    const result = await createTab.execute({ title: 'Test Tab' })

    expect(mockTabRepository.create).toHaveBeenCalledWith({ title: 'Test Tab' })
    expect(result).toBe(mockTab)
  })

  it('should not emit events (events are handled by Store layer)', async () => {
    const mockTab = createMockTab({ id: 'tab-1', title: 'Test Tab' })
    vi.mocked(mockTabRepository.create).mockReturnValue(mockTab)

    await createTab.execute({ title: 'Test Tab' })

    expect(mockEventBus.emit).not.toHaveBeenCalled()
  })
})
