import type { ITabQueries } from '@core/domain/ports/queries/ITabQueries'
import type { Tab } from '@core/entities/Tab'
import { useTabsStore } from '@/stores/tabs'

export function useTabQueries(): ITabQueries {
  const store = useTabsStore()

  return {
    getById: (id: string): Tab | undefined => store.getById(id),
    getAll: (): Tab[] => store.getAll(),
    getActive: (): Tab | undefined => store.getActiveTab(),
    getDirty: (): Tab[] => store.getDirtyTabs(),
    findByPath: (path: string): Tab | undefined => store.findTabByFilePath(path),
    getCount: (): number => store.getTabCount(),
    getOrder: (): string[] => store.getTabOrder(),
    hasOpenFiles: (): boolean => store.hasOpenFiles(),
  }
}
