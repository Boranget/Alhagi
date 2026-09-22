import type { SearchQuery, SearchMatch } from '@core/entities/Search'

export interface ISearchQueries {
  getQuery(): SearchQuery | null
  getMatches(): SearchMatch[]
  getCurrentIndex(): number
  getTotal(): number
  getCurrentMatch(): SearchMatch | null
}
