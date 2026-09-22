import type { ISearchQueries } from '@core/domain/ports/queries/ISearchQueries'
import type { SearchQuery, SearchMatch } from '@core/entities/Search'
import { useSearchStore } from '@/stores/search'

export function useSearchQueries(): ISearchQueries {
  const store = useSearchStore()

  return {
    getQuery: (): SearchQuery | null => {
      const raw = store.currentQuery
      if (!raw) return null
      return {
        pattern: raw.search,
        caseSensitive: raw.caseSensitive,
        wholeWord: raw.wholeWord,
        isRegex: raw.regexp,
        searchIn: 'file',
      }
    },
    getMatches: (): SearchMatch[] => {
      return store.currentMatches.map(m => ({
        line: 0,
        column: m.from,
        length: m.to - m.from,
        text: m.match ? m.match[0] : '',
      }))
    },
    getCurrentIndex: (): number => store.currentIndex,
    getTotal: (): number => store.totalMatches,
    getCurrentMatch: (): SearchMatch | null => {
      const matches = store.currentMatches
      const idx = store.currentIndex
      if (idx >= 0 && idx < matches.length) {
        const m = matches[idx]
        return { line: 0, column: m.from, length: m.to - m.from, text: m.match ? m.match[0] : '' }
      }
      return null
    },
  }
}
