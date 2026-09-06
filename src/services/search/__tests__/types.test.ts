import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SearchService, SearchResult, ReplaceResult } from '../types'
import type { SearchConfig } from '@/utils/search'

describe('SearchService Interface', () => {
  it('should define correct types', () => {
    const result: SearchResult = { current: 0, total: 5 }
    expect(result).toBeDefined()
    expect(result.current).toBe(0)
    expect(result.total).toBe(5)

    const replaceResult: ReplaceResult = { replaced: 3 }
    expect(replaceResult).toBeDefined()
    expect(replaceResult.replaced).toBe(3)
  })

  it('should work with mock SearchService', () => {
    const mockService: SearchService = {
      search: vi.fn().mockReturnValue({ current: 0, total: 2 }),
      clear: vi.fn(),
      findNext: vi.fn().mockReturnValue({ current: 1, total: 2 }),
      findPrev: vi.fn().mockReturnValue({ current: 0, total: 2 }),
      replaceNext: vi.fn().mockReturnValue({ current: 0, total: 1 }),
      replaceAll: vi.fn().mockReturnValue({ replaced: 2 }),
    }

    const config: SearchConfig = {
      search: 'test',
      caseSensitive: false,
      wholeWord: false,
      regexp: false,
    }

    const result = mockService.search(config)
    expect(result.total).toBe(2)

    mockService.clear()
    expect(mockService.clear).toHaveBeenCalled()

    const nextResult = mockService.findNext()
    expect(nextResult.current).toBe(1)

    const prevResult = mockService.findPrev()
    expect(prevResult.current).toBe(0)

    const replaceResult = mockService.replaceNext('replacement')
    expect(replaceResult.total).toBe(1)

    const replaceAllResult = mockService.replaceAll('replacement')
    expect(replaceAllResult.replaced).toBe(2)
  })
})
