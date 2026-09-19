import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloseTab } from '../CloseTab'
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

describe('CloseTab', () => {
  let closeTab: CloseTab
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

    closeTab = new CloseTab(mockTabRepository, mockEventBus)
  })

  it('should delete the tab', async () => {
    const mockTab = createMockTab({ id: 'tab-1', title: 'Test Tab' })
    vi.mocked(mockTabRepository.getById).mockReturnValue(mockTab)
    vi.mocked(mockTabRepository.getActiveTab).mockReturnValue(undefined)

    await closeTab.execute('tab-1')

    expect(mockTabRepository.delete).toHaveBeenCalledWith('tab-1')
  })

  it('should emit tab:closed event', async () => {
    const mockTab = createMockTab({ id: 'tab-1', title: 'Test Tab' })
    vi.mocked(mockTabRepository.getById).mockReturnValue(mockTab)
    vi.mocked(mockTabRepository.getActiveTab).mockReturnValue(undefined)

    await closeTab.execute('tab-1')

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:closed', {
      tabId: 'tab-1',
      tab: mockTab.toProps(),
    })
  })

  it('should emit tab:switched event when there is an active tab', async () => {
    const closedTab = createMockTab({ id: 'tab-1', title: 'Closed Tab' })
    const activeTab = createMockTab({ id: 'tab-2', title: 'Active Tab' })
    
    vi.mocked(mockTabRepository.getById).mockReturnValue(closedTab)
    vi.mocked(mockTabRepository.getActiveTab).mockReturnValue(activeTab)

    await closeTab.execute('tab-1')

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:switched', {
      tabId: 'tab-2',
      previousTabId: 'tab-1',
    })
  })

  it('should not emit tab:switched event when no active tab', async () => {
    const mockTab = createMockTab({ id: 'tab-1', title: 'Test Tab' })
    vi.mocked(mockTabRepository.getById).mockReturnValue(mockTab)
    vi.mocked(mockTabRepository.getActiveTab).mockReturnValue(undefined)

    await closeTab.execute('tab-1')

    expect(mockEventBus.emit).toHaveBeenCalledTimes(1)
    expect(mockEventBus.emit).not.toHaveBeenCalledWith('app:tab:switched', expect.anything())
  })

  it('should do nothing when tab does not exist', async () => {
    vi.mocked(mockTabRepository.getById).mockReturnValue(undefined)

    await closeTab.execute('non-existent')

    expect(mockTabRepository.delete).not.toHaveBeenCalled()
    expect(mockEventBus.emit).not.toHaveBeenCalled()
  })
})
