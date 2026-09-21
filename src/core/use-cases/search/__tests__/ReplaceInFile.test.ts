import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReplaceInFile } from '../ReplaceInFile'
import type { ISearchRepository } from '@core/domain/ports/repositories/ISearchRepository'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { Tab } from '@core/entities/Tab'

function createMockTab(content: string): Tab {
  return new Tab({
    id: 'tab-1', title: 'test.md', filePath: '/path/to/test.md',
    content, isDirty: false, viewMode: 'wysiwyg', splitRatio: 50, fileType: 'editor',
    createdAt: Date.now(), lastModified: Date.now(), lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0, undoStack: [], redoStack: [] },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0, undoStack: [], redoStack: [] },
  })
}

describe('ReplaceInFile', () => {
  let replaceInFile: ReplaceInFile
  let mockSearchRepo: ISearchRepository
  let mockTabRepo: ITabRepository
  let mockEventBus: IEventBus

  beforeEach(() => {
    mockSearchRepo = {
      getQuery: vi.fn().mockReturnValue({ pattern: 'hello', caseSensitive: false, wholeWord: false, isRegex: false }),
      setQuery: vi.fn(), getMatches: vi.fn(), setMatches: vi.fn(),
      getCurrentIndex: vi.fn(), setCurrentIndex: vi.fn(), getTotal: vi.fn(),
      clear: vi.fn(), findNext: vi.fn(), findPrev: vi.fn(),
      getCurrentMatch: vi.fn().mockReturnValue({ line: 0, column: 0, length: 5, text: 'hello', context: 'hello world' }),
    }
    mockTabRepo = {
      getAll: vi.fn(), getById: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), getActiveTab: vi.fn(),
      getActiveTabId: vi.fn(), setActiveTab: vi.fn(), getDirtyTabs: vi.fn(),
      markDirty: vi.fn(), markClean: vi.fn(), setViewMode: vi.fn(),
      setSplitRatio: vi.fn(), findTabByFilePath: vi.fn(),
      getTabCount: vi.fn(), getTabOrder: vi.fn(), hasOpenFiles: vi.fn(), insert: vi.fn(),
    }
    mockEventBus = {
      on: vi.fn(), off: vi.fn(), emit: vi.fn(), once: vi.fn(),
      subscribe: vi.fn(), clear: vi.fn(), hasListeners: vi.fn(), getListenerCount: vi.fn(),
    }
    replaceInFile = new ReplaceInFile(mockSearchRepo, mockTabRepo, mockEventBus)
  })

  it('should replace current match in content', async () => {
    const tab = createMockTab('hello world')
    vi.mocked(mockTabRepo.getActiveTab).mockReturnValue(tab)

    const result = await replaceInFile.execute('world')

    expect(mockTabRepo.update).toHaveBeenCalledWith('tab-1', { content: 'world world' })
    expect(mockTabRepo.markDirty).toHaveBeenCalledWith('tab-1')
    expect(mockEventBus.emit).toHaveBeenCalledWith('editor:content:changed', expect.objectContaining({ content: 'world world' }))
    expect(result).toBe(true)
  })

  it('should return false when no active tab', async () => {
    vi.mocked(mockTabRepo.getActiveTab).mockReturnValue(undefined)
    const result = await replaceInFile.execute('replacement')
    expect(result).toBe(false)
  })

  it('should return false when no query', async () => {
    vi.mocked(mockSearchRepo.getQuery).mockReturnValue(null)
    const result = await replaceInFile.execute('replacement')
    expect(result).toBe(false)
  })

  it('should return false when no current match', async () => {
    vi.mocked(mockSearchRepo.getCurrentMatch).mockReturnValue(null)
    const result = await replaceInFile.execute('replacement')
    expect(result).toBe(false)
  })
})
