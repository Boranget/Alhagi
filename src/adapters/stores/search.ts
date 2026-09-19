import type { ISearchRepository } from '@core/domain/ports/repositories/ISearchRepository'
import type { SearchQuery, SearchMatch } from '@core/entities/Search'
import { defineStore } from 'pinia'
import { useSearchStore } from '@/stores/search'

/**
 * SearchRepository adapter - 代理原始 useSearchStore
 * 
 * 架构设计：
 * - 实现 Core 层定义的 ISearchRepository 接口
 * - 内部代理原始 Pinia store，保持数据一致性
 * - 将原始搜索结果转换为 SearchMatch 实体供 Core 层使用
 */
export const useSearchRepository = defineStore('searchRepo', (): ISearchRepository => {
  const originalStore = useSearchStore()

  // 原始匹配 -> SearchMatch 实体转换
  function toSearchMatch(raw: { from: number; to: number; match?: RegExpExecArray; matchStart?: number; codeBlockPmPos?: number }): SearchMatch {
    return {
      line: 0, // 原始 store 没有 line 信息
      column: raw.from,
      length: raw.to - raw.from,
      text: raw.match ? raw.match[0] : '',
    }
  }

  // SearchQuery 转换为原始 SearchConfig
  function toSearchConfig(query: SearchQuery) {
    return {
      search: query.pattern,
      caseSensitive: query.caseSensitive,
      wholeWord: query.wholeWord,
      regexp: query.isRegex,
    }
  }

  const getQuery = (): SearchQuery | null => {
    const raw = originalStore.currentQuery
    if (!raw) return null
    return {
      pattern: raw.search,
      caseSensitive: raw.caseSensitive,
      wholeWord: raw.wholeWord,
      isRegex: raw.regexp,
      searchIn: 'file',
    }
  }

  const setQuery = (query: SearchQuery): void => {
    originalStore.search(toSearchConfig(query))
  }

  const getMatches = (): SearchMatch[] => {
    return originalStore.currentMatches.map(toSearchMatch)
  }

  const setMatches = (_matches: SearchMatch[]): void => {
    // matches 是只读的，由 search/findNext/findPrev 填充
  }

  const getCurrentIndex = (): number => {
    return originalStore.currentIndex
  }

  const setCurrentIndex = (index: number): void => {
    originalStore.currentIndex = index
  }

  const getTotal = (): number => {
    return originalStore.totalMatches
  }

  const clear = (): void => {
    originalStore.clear()
  }

  const findNext = (): SearchMatch | null => {
    const result = originalStore.findNext()
    if (result.total === 0) return null
    const matches = originalStore.currentMatches
    const idx = originalStore.currentIndex
    if (idx >= 0 && idx < matches.length) {
      return toSearchMatch(matches[idx])
    }
    return null
  }

  const findPrev = (): SearchMatch | null => {
    const result = originalStore.findPrev()
    if (result.total === 0) return null
    const matches = originalStore.currentMatches
    const idx = originalStore.currentIndex
    if (idx >= 0 && idx < matches.length) {
      return toSearchMatch(matches[idx])
    }
    return null
  }

  const getCurrentMatch = (): SearchMatch | null => {
    const matches = originalStore.currentMatches
    const idx = originalStore.currentIndex
    if (idx >= 0 && idx < matches.length) {
      return toSearchMatch(matches[idx])
    }
    return null
  }

  return {
    getQuery,
    setQuery,
    getMatches,
    setMatches,
    getCurrentIndex,
    setCurrentIndex,
    getTotal,
    clear,
    findNext,
    findPrev,
    getCurrentMatch,
  }
})
