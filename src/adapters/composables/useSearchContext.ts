import { storeToRefs } from 'pinia'
import { useSearchStore } from '@/stores/search'
import type { SearchConfig } from '@/utils/search'

export function useSearchContext() {
  const store = useSearchStore()
  const { currentQuery, currentIndex, totalMatches } = storeToRefs(store)

  return {
    currentQuery,
    currentIndex,
    totalMatches,
    search: (config: SearchConfig, options?: { select?: boolean }) => store.search(config, options),
    clear: () => store.clear(),
    findNext: () => store.findNext(),
    findPrev: () => store.findPrev(),
    replaceNext: (replacement: string) => store.replaceNext(replacement),
    replaceAll: (replacement: string) => store.replaceAll(replacement),
  }
}

export type SearchContext = ReturnType<typeof useSearchContext>
