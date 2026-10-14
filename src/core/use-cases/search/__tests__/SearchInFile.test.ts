import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SearchInFile } from '../SearchInFile'
import type { ISearchRepository } from '@core/domain/ports/repositories/ISearchRepository'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { Tab } from '@core/entities/Tab'

function createMockTab(content: string): Tab {
  return new Tab({
    id: 'tab-1',
    title: 'test.md',
    filePath: '/path/to/test.md',
    content,
    isDirty: false,
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'editor',
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
  })
}

describe('SearchInFile', () => {
  let searchInFile: SearchInFile
  let mockSearchRepo: ISearchRepository
  let mockTabRepo: ITabRepository
  let mockEventBus: IEventBus

  beforeEach(() => {
    mockSearchRepo = {
      getQuery: vi.fn(),
      setQuery: vi.fn(),
      getMatches: vi.fn(),
      setMatches: vi.fn(),
      getCurrentIndex: vi.fn(),
      setCurrentIndex: vi.fn(),
      getTotal: vi.fn(),
      clear: vi.fn(),
      findNext: vi.fn(),
      findPrev: vi.fn(),
      getCurrentMatch: vi.fn(),
    }
    mockTabRepo = {
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
    searchInFile = new SearchInFile(mockSearchRepo, mockTabRepo, mockEventBus)
  })

  it('should find matches in content', async () => {
    const tab = createMockTab('hello world\nhello again')
    vi.mocked(mockTabRepo.getActiveTab).mockReturnValue(tab)

    const matches = await searchInFile.execute({ pattern: 'hello', caseSensitive: false, wholeWord: false, isRegex: false, searchIn: 'file' as const })

    expect(matches.length).toBe(2)
    expect(matches[0].text).toBe('hello')
    expect(matches[0].line).toBe(0)
    expect(matches[1].text).toBe('hello')
    expect(matches[1].line).toBe(1)
    expect(mockSearchRepo.setQuery).toHaveBeenCalled()
    expect(mockSearchRepo.setMatches).toHaveBeenCalledWith(matches)
  })

  it('should return empty array when no active tab', async () => {
    vi.mocked(mockTabRepo.getActiveTab).mockReturnValue(undefined)

    const matches = await searchInFile.execute({ pattern: 'hello', caseSensitive: false, wholeWord: false, isRegex: false, searchIn: 'file' as const })

    expect(matches).toEqual([])
  })

  it('should handle regex search', async () => {
    const tab = createMockTab('foo123 bar456')
    vi.mocked(mockTabRepo.getActiveTab).mockReturnValue(tab)

    const matches = await searchInFile.execute({ pattern: '\\d+', caseSensitive: false, wholeWord: false, isRegex: true, searchIn: 'file' as const })

    expect(matches.length).toBe(2)
    expect(matches[0].text).toBe('123')
    expect(matches[1].text).toBe('456')
  })

  it('should handle case sensitive search', async () => {
    const tab = createMockTab('Hello hello HELLO')
    vi.mocked(mockTabRepo.getActiveTab).mockReturnValue(tab)

    const matches = await searchInFile.execute({ pattern: 'hello', caseSensitive: true, wholeWord: false, isRegex: false, searchIn: 'file' as const })

    expect(matches.length).toBe(1)
    expect(matches[0].text).toBe('hello')
  })

  it('should handle whole word search', async () => {
    const tab = createMockTab('hello world hello-world sayhello')
    vi.mocked(mockTabRepo.getActiveTab).mockReturnValue(tab)

    const matches = await searchInFile.execute({ pattern: 'hello', caseSensitive: false, wholeWord: true, isRegex: false, searchIn: 'file' as const })

    expect(matches.length).toBe(2)
    expect(matches[0].text).toBe('hello')
    expect(matches[1].text).toBe('hello')
  })

  it('should return empty for invalid regex', async () => {
    const tab = createMockTab('test content')
    vi.mocked(mockTabRepo.getActiveTab).mockReturnValue(tab)

    const matches = await searchInFile.execute({ pattern: '[invalid', caseSensitive: false, wholeWord: false, isRegex: true, searchIn: 'file' as const })

    expect(matches).toEqual([])
  })
})
