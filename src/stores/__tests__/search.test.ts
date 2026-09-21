import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSearchStore } from '../search'
import type { SearchService, SearchResult, ReplaceResult } from '@/services/search/types'

function createMockSearchService(): SearchService {
  return {
    search: vi.fn().mockReturnValue({ current: 0, total: 0 } as SearchResult),
    findNext: vi.fn().mockReturnValue({ current: 0, total: 0 } as SearchResult),
    findPrev: vi.fn().mockReturnValue({ current: 0, total: 0 } as SearchResult),
    replaceNext: vi.fn().mockReturnValue({ current: 0, total: 0 } as SearchResult),
    replaceAll: vi.fn().mockReturnValue({ replaced: 0 } as ReplaceResult),
    clear: vi.fn(),
  } as unknown as SearchService
}

describe('Search Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty search state', () => {
      const store = useSearchStore()
      expect(store.currentQuery).toBeNull()
      expect(store.currentIndex).toBe(-1)
      expect(store.totalMatches).toBe(0)
    })
  })

  describe('setSearchService / getSearchService', () => {
    it('should set and get search service', () => {
      const store = useSearchStore()
      const service = createMockSearchService()
      store.setSearchService(service)
      expect(store.getSearchService()).toBe(service)
    })

    it('should accept null to clear service', () => {
      const store = useSearchStore()
      store.setSearchService(createMockSearchService())
      store.setSearchService(null)
      expect(store.getSearchService()).toBeNull()
    })
  })

  describe('search', () => {
    it('should delegate to search service and update state', () => {
      const store = useSearchStore()
      const service = createMockSearchService()
      vi.mocked(service.search).mockReturnValue({ current: 2, total: 5 } as SearchResult)
      store.setSearchService(service)

      const result = store.search({ search: 'hello', caseSensitive: false, wholeWord: false, regexp: false })

      expect(service.search).toHaveBeenCalled()
      expect(result.current).toBe(2)
      expect(result.total).toBe(5)
      expect(store.currentIndex).toBe(2)
      expect(store.totalMatches).toBe(5)
      expect(store.currentQuery?.search).toBe('hello')
    })

    it('should return empty result when no service', () => {
      const store = useSearchStore()
      const result = store.search({ search: 'test', caseSensitive: false, wholeWord: false, regexp: false })
      expect(result.current).toBe(0)
      expect(result.total).toBe(0)
    })
  })

  describe('clear', () => {
    it('should reset all search state', () => {
      const store = useSearchStore()
      const service = createMockSearchService()
      vi.mocked(service.search).mockReturnValue({ current: 1, total: 3 } as SearchResult)
      store.setSearchService(service)
      store.search({ search: 'test', caseSensitive: false, wholeWord: false, regexp: false })

      store.clear()

      expect(store.currentQuery).toBeNull()
      expect(store.currentIndex).toBe(-1)
      expect(store.totalMatches).toBe(0)
      expect(service.clear).toHaveBeenCalled()
    })
  })

  describe('findNext / findPrev', () => {
    it('should navigate forward', () => {
      const store = useSearchStore()
      const service = createMockSearchService()
      vi.mocked(service.findNext).mockReturnValue({ current: 3, total: 5 } as SearchResult)
      store.setSearchService(service)

      store.findNext()

      expect(service.findNext).toHaveBeenCalled()
      expect(store.currentIndex).toBe(3)
    })

    it('should navigate backward', () => {
      const store = useSearchStore()
      const service = createMockSearchService()
      vi.mocked(service.findPrev).mockReturnValue({ current: 0, total: 5 } as SearchResult)
      store.setSearchService(service)

      store.findPrev()

      expect(service.findPrev).toHaveBeenCalled()
      expect(store.currentIndex).toBe(0)
    })

    it('findNext should return empty when no service', () => {
      const store = useSearchStore()
      const result = store.findNext()
      expect(result.current).toBe(0)
    })
  })

  describe('replaceNext / replaceAll', () => {
    it('should replace next occurrence', () => {
      const store = useSearchStore()
      const service = createMockSearchService()
      vi.mocked(service.replaceNext).mockReturnValue({ current: 1, total: 2 } as SearchResult)
      store.setSearchService(service)

      store.replaceNext('world')

      expect(service.replaceNext).toHaveBeenCalledWith('world')
      expect(store.currentIndex).toBe(1)
    })

    it('should replace all occurrences', () => {
      const store = useSearchStore()
      const service = createMockSearchService()
      vi.mocked(service.replaceAll).mockReturnValue({ replaced: 5 } as ReplaceResult)
      store.setSearchService(service)

      const result = store.replaceAll('world')

      expect(service.replaceAll).toHaveBeenCalledWith('world')
      expect(result.replaced).toBe(5)
    })
  })

  describe('$reset', () => {
    it('should reset all state including service', () => {
      const store = useSearchStore()
      store.setSearchService(createMockSearchService())

      store.$reset()

      expect(store.currentQuery).toBeNull()
      expect(store.getSearchService()).toBeNull()
    })
  })
})
