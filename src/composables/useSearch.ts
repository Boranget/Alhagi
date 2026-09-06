import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import type { SearchService } from '@/services/search'

export const SearchServiceKey: InjectionKey<Ref<SearchService | null>> = Symbol('searchService')

export function provideSearchService(service: Ref<SearchService | null>) {
  provide(SearchServiceKey, service)
}

export function useSearch(): Ref<SearchService | null> {
  return inject(SearchServiceKey, ref(null))
}
