import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SwitchTab } from '../SwitchTab'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { Tab } from '@core/entities/Tab'

const defaultEditorState = {
  cursor: { from: 0, to: 0 },
  scrollTop: 0,
  undoStack: [],
  redoStack: [],
}

function createMockTab(overrides: Partial<{ id: string; title: string }> = {}): Tab {
  return new Tab({
    id: overrides.id || 'tab-1',
    title: overrides.title || 'Test Tab',
    filePath: null,
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

describe('SwitchTab', () => {
  let switchTab: SwitchTab
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

    switchTab = new SwitchTab(mockTabRepository, mockEventBus)
  })

  it('should set the active tab', async () => {
    vi.mocked(mockTabRepository.getActiveTab).mockReturnValue(undefined)

    await switchTab.execute('tab-1')

    expect(mockTabRepository.setActiveTab).toHaveBeenCalledWith('tab-1')
  })

  it('should emit tab:switched event', async () => {
    vi.mocked(mockTabRepository.getActiveTab).mockReturnValue(undefined)

    await switchTab.execute('tab-1')

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:switched', {
      tabId: 'tab-1',
      previousTabId: undefined,
    })
  })

  it('should include previous tab id when switching', async () => {
    const previousTab = createMockTab({ id: 'tab-0', title: 'Previous Tab' })
    vi.mocked(mockTabRepository.getActiveTab).mockReturnValue(previousTab)

    await switchTab.execute('tab-1')

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:switched', {
      tabId: 'tab-1',
      previousTabId: 'tab-0',
    })
  })
})
