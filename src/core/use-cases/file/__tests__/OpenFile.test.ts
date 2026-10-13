import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenFile } from '../OpenFile'
import type { IFileSystem } from '@core/domain/ports/gateways/IFileSystem'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { CreateTab } from '@core/use-cases/tabs/CreateTab'
import { Tab } from '@core/entities/Tab'

function createMockTab(overrides: Partial<{ id: string; filePath: string | null; title: string; content: string }> = {}): Tab {
  return new Tab({
    id: overrides.id || 'tab-1',
    title: overrides.title || 'test.md',
    filePath: overrides.filePath ?? '/path/to/test.md',
    content: overrides.content ?? '',
    isDirty: false,
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'editor',
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0, undoStack: [], redoStack: [] },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0, undoStack: [], redoStack: [] },
  })
}

describe('OpenFile', () => {
  let openFile: OpenFile
  let mockFileSystem: IFileSystem
  let mockTabRepository: ITabRepository
  let mockEventBus: IEventBus
  let mockCreateTab: { execute: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockFileSystem = {
      readFile: vi.fn().mockResolvedValue('# File content'),
      writeFile: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      readdir: vi.fn(),
      mkdir: vi.fn(),
      readBinary: vi.fn(),
      writeBinary: vi.fn(),
      existsBatch: vi.fn(),
      stat: vi.fn(),
      rename: vi.fn(),
      copy: vi.fn(),
      move: vi.fn(),
      ensureDirectory: vi.fn(),
      showInFolder: vi.fn(),
      getDocumentsDirectory: vi.fn(),
    }
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
    mockCreateTab = { execute: vi.fn() }
    openFile = new OpenFile(
      mockFileSystem,
      mockTabRepository,
      mockEventBus,
      mockCreateTab as unknown as CreateTab
    )
  })

  it('should open a file and create a new tab via CreateTab use case', async () => {
    vi.mocked(mockTabRepository.findTabByFilePath).mockReturnValue(undefined)
    const newTab = createMockTab()
    mockCreateTab.execute.mockResolvedValue(newTab)

    const result = await openFile.execute({ filePath: '/path/to/test.md' })

    expect(mockFileSystem.readFile).toHaveBeenCalledWith('/path/to/test.md')
    // tabRepository.create 是故意抛错的守卫；创建必须委托 CreateTab
    // （insert、活动切换、事件、Electron 同步都在 CreateTab 内）。
    expect(mockCreateTab.execute).toHaveBeenCalledWith({
      filePath: '/path/to/test.md',
      title: 'test.md',
      content: '# File content',
    })
    expect(mockTabRepository.create).not.toHaveBeenCalled()
    expect(result).toBe(newTab)
  })

  it('should switch to existing tab if file is already open', async () => {
    const existingTab = createMockTab({ id: 'existing-tab' })
    vi.mocked(mockTabRepository.findTabByFilePath).mockReturnValue(existingTab)
    vi.mocked(mockTabRepository.getActiveTabId).mockReturnValue('other-tab')

    const result = await openFile.execute({ filePath: '/path/to/test.md' })

    expect(mockFileSystem.readFile).not.toHaveBeenCalled()
    expect(mockTabRepository.setActiveTab).toHaveBeenCalledWith('existing-tab')
    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:switched', {
      tabId: 'existing-tab',
      previousTabId: 'other-tab',
    })
    expect(result).toBe(existingTab)
  })

  it('should return null when no filePath or folderPath provided', async () => {
    const result = await openFile.execute({})
    expect(result).toBeNull()
  })

  it('should emit folder:opened when folderPath is provided', async () => {
    await openFile.execute({ folderPath: '/path/to/folder' })

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:folder:opened', { folderPath: '/path/to/folder' })
  })
})
