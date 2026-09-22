import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTabsStore } from '@/stores/tabs'
import { getCreateTabUseCase, getCloseTabUseCase, getSwitchTabUseCase, getUpdateTabUseCase } from '@adapters/commandHandlers'
import type { ViewMode } from '@shared/types'

export function useTabContext() {
  const store = useTabsStore()
  const { activeTab, activeTabId, tabCount, dirtyTabs } = storeToRefs(store)

  const createTabUseCase = getCreateTabUseCase()
  const closeTabUseCase = getCloseTabUseCase()
  const switchTabUseCase = getSwitchTabUseCase()
  const updateTabUseCase = getUpdateTabUseCase()

  return {
    activeTab,
    activeTabId,
    tabCount,
    dirtyTabs,
    allTabs: computed(() => store.getAllTabs()),
    getTab: (id: string) => store.getTab(id),
    findByPath: (path: string) => store.findTabByFilePath(path),
    create: async (options?: { filePath?: string; content?: string; title?: string; viewMode?: ViewMode; fileType?: import('@shared/types').FileType; splitRatio?: number }) => {
      return createTabUseCase.execute(options)
    },
    close: async (id: string) => {
      await closeTabUseCase.execute(id)
    },
    switch: async (id: string) => {
      await switchTabUseCase.execute(id)
    },
    update: async (id: string, updates: Partial<import('@shared/types').TabState>) => {
      await updateTabUseCase.execute(id, updates)
    },
    markDirty: (id: string) => store.markDirty(id),
    markClean: (id: string) => store.markClean(id),
    setViewMode: (id: string, mode: ViewMode) => store.setViewMode(id, mode),
  }
}

export type TabContext = ReturnType<typeof useTabContext>
