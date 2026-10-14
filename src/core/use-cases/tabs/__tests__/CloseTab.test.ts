import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloseTab } from '../CloseTab'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { IElectronSync } from '@core/domain/ports/gateways/IElectronSync'
import { Tab } from '@core/entities/Tab'

const defaultEditorState = {
  cursor: { from: 0, to: 0 },
  scrollTop: 0,
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
  let mockElectronSync: IElectronSync

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

    mockElectronSync = { syncOpenedFiles: vi.fn().mockResolvedValue(undefined) } as unknown as IElectronSync

    closeTab = new CloseTab(mockTabRepository, mockEventBus, mockElectronSync)
  })

  it('should delete the tab and emit TAB_CLOSED', async () => {
    const mockTab = createMockTab({ id: 'tab-1', title: 'Test Tab' })
    vi.mocked(mockTabRepository.getById).mockReturnValue(mockTab)
    vi.mocked(mockTabRepository.getTabOrder).mockReturnValue(['tab-1'])
    vi.mocked(mockTabRepository.getActiveTabId).mockReturnValue(null)
    vi.mocked(mockTabRepository.getAll).mockReturnValue([])

    await closeTab.execute('tab-1')

    expect(mockTabRepository.delete).toHaveBeenCalledWith('tab-1')
    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:closed', expect.objectContaining({ tabId: 'tab-1' }))
  })

  it('should do nothing when tab does not exist', async () => {
    vi.mocked(mockTabRepository.getById).mockReturnValue(undefined)

    await closeTab.execute('non-existent')

    expect(mockTabRepository.delete).not.toHaveBeenCalled()
  })

  it('should switch to neighbor tab when closing the active tab', async () => {
    const tab1 = createMockTab({ id: 'tab-1' })
    const tab2 = createMockTab({ id: 'tab-2' })
    vi.mocked(mockTabRepository.getById).mockReturnValue(tab1)
    vi.mocked(mockTabRepository.getTabOrder)
      .mockReturnValueOnce(['tab-1', 'tab-2'])
      .mockReturnValueOnce(['tab-2'])
    vi.mocked(mockTabRepository.getActiveTabId).mockReturnValue('tab-1')
    vi.mocked(mockTabRepository.getAll).mockReturnValue([tab2])

    await closeTab.execute('tab-1')

    expect(mockTabRepository.setActiveTab).toHaveBeenCalledWith('tab-2')
  })
})
