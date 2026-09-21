import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteFile } from '../DeleteFile'
import type { IFileSystem } from '@core/domain/ports/gateways/IFileSystem'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { Tab } from '@core/entities/Tab'

function createMockTab(overrides: Partial<{ id: string; filePath: string | null }> = {}): Tab {
  return new Tab({
    id: overrides.id || 'tab-1',
    title: 'test.md',
    filePath: overrides.filePath ?? '/path/to/test.md',
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
}

describe('DeleteFile', () => {
  let deleteFile: DeleteFile
  let mockFileSystem: IFileSystem
  let mockTabRepository: ITabRepository
  let mockEventBus: IEventBus

  beforeEach(() => {
    mockFileSystem = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
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
    deleteFile = new DeleteFile(mockFileSystem, mockTabRepository, mockEventBus)
  })

  it('should delete file and close tab if open', async () => {
    const tab = createMockTab()
    vi.mocked(mockTabRepository.findTabByFilePath).mockReturnValue(tab)

    const result = await deleteFile.execute('/path/to/test.md')

    expect(mockFileSystem.delete).toHaveBeenCalledWith('/path/to/test.md')
    expect(mockTabRepository.delete).toHaveBeenCalledWith('tab-1')
    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:closed', expect.objectContaining({ tabId: 'tab-1' }))
    expect(result).toBe(true)
  })

  it('should delete file without closing tab if not open', async () => {
    vi.mocked(mockTabRepository.findTabByFilePath).mockReturnValue(undefined)

    const result = await deleteFile.execute('/path/to/orphan.md')

    expect(mockFileSystem.delete).toHaveBeenCalledWith('/path/to/orphan.md')
    expect(mockTabRepository.delete).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('should return false on delete error', async () => {
    vi.mocked(mockFileSystem.delete).mockRejectedValue(new Error('Permission denied'))

    const result = await deleteFile.execute('/path/to/locked.md')

    expect(result).toBe(false)
  })
})
