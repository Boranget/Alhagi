import type { Search, SearchQuery, SearchMatch } from '@core/entities/Search'

export interface ISearchRepository {
  getQuery(): SearchQuery | null
  setQuery(query: SearchQuery): void
  getMatches(): SearchMatch[]
  setMatches(matches: SearchMatch[]): void
  getCurrentIndex(): number
  setCurrentIndex(index: number): void
  getTotal(): number
  clear(): void
  findNext(): SearchMatch | null
  findPrev(): SearchMatch | null
  getCurrentMatch(): SearchMatch | null
}
