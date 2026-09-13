import { SearchInFile } from '@core/use-cases/search/SearchInFile'
import { ReplaceInFile } from '@core/use-cases/search/ReplaceInFile'
import { useSearchRepository } from '@adapters/stores/search'
import { useTabRepository } from '@adapters/stores/tabs'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'
import type { SearchQuery } from '@core/entities/Search'

export function useSearch() {
  const searchRepository = useSearchRepository()
  const tabRepository = useTabRepository()
  const eventBus = useEventBusGateway()

  const searchInFile = new SearchInFile(searchRepository, tabRepository, eventBus)
  const replaceInFile = new ReplaceInFile(searchRepository, tabRepository, eventBus)

  return {
    search: (query: SearchQuery) => searchInFile.execute(query),
    replace: (replacement: string) => replaceInFile.execute(replacement),
    findNext: () => searchRepository.findNext(),
    findPrev: () => searchRepository.findPrev(),
    clear: () => searchRepository.clear(),
    getQuery: () => searchRepository.getQuery(),
    getMatches: () => searchRepository.getMatches(),
    getCurrentIndex: () => searchRepository.getCurrentIndex(),
    getTotal: () => searchRepository.getTotal(),
    getCurrentMatch: () => searchRepository.getCurrentMatch(),
  }
}
