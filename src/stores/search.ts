import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SearchConfig } from '@/utils/search'
import type { SearchService, SearchResult, ReplaceResult } from '@/services/search/types'

interface SearchQuery {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

export const useSearchStore = defineStore('search', () => {
  const currentQuery = ref<SearchQuery | null>(null)
  const currentMatches = ref<Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>>([])
  const currentIndex = ref(-1)
  const totalMatches = ref(0)

  let searchService: SearchService | null = null

  function setSearchService(service: SearchService | null) {
    searchService = service
  }

  function getSearchService(): SearchService | null {
    return searchService
  }

  function search(config: SearchConfig, options?: { select?: boolean }): SearchResult {
    if (!searchService) return { current: 0, total: 0 }
    const result = searchService.search(config, options)
    currentQuery.value = {
      search: config.search,
      caseSensitive: config.caseSensitive ?? false,
      wholeWord: config.wholeWord ?? false,
      regexp: config.regexp ?? false,
    }
    currentIndex.value = result.current
    totalMatches.value = result.total
    return result
  }

  function clear(): void {
    searchService?.clear()
    currentQuery.value = null
    currentMatches.value = []
    currentIndex.value = -1
    totalMatches.value = 0
  }

  function findNext(): SearchResult {
    if (!searchService) return { current: 0, total: 0 }
    const result = searchService.findNext()
    currentIndex.value = result.current
    totalMatches.value = result.total
    return result
  }

  function findPrev(): SearchResult {
    if (!searchService) return { current: 0, total: 0 }
    const result = searchService.findPrev()
    currentIndex.value = result.current
    totalMatches.value = result.total
    return result
  }

  function replaceNext(replacement: string): SearchResult {
    if (!searchService) return { current: 0, total: 0 }
    const result = searchService.replaceNext(replacement)
    currentIndex.value = result.current
    totalMatches.value = result.total
    return result
  }

  function replaceAll(replacement: string): ReplaceResult {
    if (!searchService) return { replaced: 0 }
    return searchService.replaceAll(replacement)
  }

  function $reset() {
    currentQuery.value = null
    currentMatches.value = []
    currentIndex.value = -1
    totalMatches.value = 0
    searchService = null
  }

  return {
    currentQuery,
    currentMatches,
    currentIndex,
    totalMatches,
    setSearchService,
    getSearchService,
    search,
    clear,
    findNext,
    findPrev,
    replaceNext,
    replaceAll,
    $reset,
  }
})
