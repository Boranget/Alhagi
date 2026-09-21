import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SaveFile } from '../SaveFile'
import type { IFileSystem } from '@core/domain/ports/gateways/IFileSystem'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { Tab } from '@core/entities/Tab'

function createMockTab(overrides: Partial<{ id: string; filePath: string | null; content: string }> = {}): Tab {
  return new Tab({
    id: overrides.id || 'tab-1',
    title: 'test.md',
    filePath: overrides.filePath ?? '/path/to/test.md',
    content: overrides.content ?? '# Hello',
    isDirty: true,
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

describe('SaveFile', () => {
  let saveFile: SaveFile
  let mockFileSystem: IFileSystem
  let mockTabRepository: ITabRepository
  let mockEventBus: IEventBus

  beforeEach(() => {
    mockFileSystem = {
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
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
    saveFile = new SaveFile(mockFileSystem, mockTabRepository, mockEventBus)
  })

  it('should save file and mark clean', async () => {
    const tab = createMockTab()
    vi.mocked(mockTabRepository.getById).mockReturnValue(tab)

    const result = await saveFile.execute('tab-1')

    expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/path/to/test.md', '# Hello')
    expect(mockTabRepository.markClean).toHaveBeenCalledWith('tab-1')
    expect(mockEventBus.emit).toHaveBeenCalledWith('app:file:saved', { filePath: '/path/to/test.md', tabId: 'tab-1' })
    expect(result).toBe(true)
  })

  it('should return false when tab not found', async () => {
    vi.mocked(mockTabRepository.getById).mockReturnValue(undefined)

    const result = await saveFile.execute('nonexistent')

    expect(result).toBe(false)
    expect(mockFileSystem.writeFile).not.toHaveBeenCalled()
  })

  it('should return false when tab has no filePath', async () => {
    const tab = new Tab({
      id: 'tab-1',
      title: 'untitled',
      filePath: null,
      content: '',
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
    vi.mocked(mockTabRepository.getById).mockReturnValue(tab)

    const result = await saveFile.execute('tab-1')

    expect(result).toBe(false)
    expect(mockFileSystem.writeFile).not.toHaveBeenCalled()
  })

  it('should return false on write error', async () => {
    const tab = createMockTab()
    vi.mocked(mockTabRepository.getById).mockReturnValue(tab)
    vi.mocked(mockFileSystem.writeFile).mockRejectedValue(new Error('Permission denied'))

    const result = await saveFile.execute('tab-1')

    expect(result).toBe(false)
  })

  it('should save as new path', async () => {
    const tab = createMockTab()
    vi.mocked(mockTabRepository.getById).mockReturnValue(tab)

    const result = await saveFile.saveAs('tab-1', '/new/path.md')

    expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/new/path.md', '# Hello')
    expect(mockTabRepository.update).toHaveBeenCalledWith('tab-1', { filePath: '/new/path.md' })
    expect(mockTabRepository.markClean).toHaveBeenCalledWith('tab-1')
    expect(result).toBe(true)
  })
})
