import type { SearchConfig } from '@/utils/search'

export interface SearchResult {
  current: number
  total: number
}

export interface ReplaceResult {
  replaced: number
}

export interface SearchService {
  search(config: SearchConfig, options?: { select?: boolean }): SearchResult
  clear(): void
  findNext(): SearchResult
  findPrev(): SearchResult
  replaceNext(replacement: string): SearchResult
  replaceAll(replacement: string): ReplaceResult
}
