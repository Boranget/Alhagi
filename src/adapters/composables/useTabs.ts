import { CreateTab } from '@core/use-cases/tabs/CreateTab'
import { CloseTab } from '@core/use-cases/tabs/CloseTab'
import { SwitchTab } from '@core/use-cases/tabs/SwitchTab'
import { UpdateTab } from '@core/use-cases/tabs/UpdateTab'
import { useTabRepository } from '@adapters/stores/tabs'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'
import type { CreateTabOptions, TabUpdates } from '@core/interfaces/repositories/ITabRepository'
import type { ViewMode } from '@shared/types'

export function useTabs() {
  const tabRepository = useTabRepository()
  const eventBus = useEventBusGateway()

  const createTab = new CreateTab(tabRepository, eventBus)
  const closeTab = new CloseTab(tabRepository, eventBus)
  const switchTab = new SwitchTab(tabRepository, eventBus)
  const updateTab = new UpdateTab(tabRepository, eventBus)

  return {
    create: (options?: CreateTabOptions) => createTab.execute(options),
    close: (tabId: string) => closeTab.execute(tabId),
    switch: (tabId: string) => switchTab.execute(tabId),
    update: (tabId: string, updates: Partial<TabUpdates>) => updateTab.execute(tabId, updates),
    getAll: () => tabRepository.getAll(),
    getById: (id: string) => tabRepository.getById(id),
    getActiveTab: () => tabRepository.getActiveTab(),
    getActiveTabId: () => tabRepository.getActiveTabId(),
    setActiveTab: (id: string) => tabRepository.setActiveTab(id),
    getDirtyTabs: () => tabRepository.getDirtyTabs(),
    markDirty: (id: string) => tabRepository.markDirty(id),
    markClean: (id: string) => tabRepository.markClean(id),
    setViewMode: (id: string, mode: ViewMode) => tabRepository.setViewMode(id, mode),
    setSplitRatio: (id: string, ratio: number) => tabRepository.setSplitRatio(id, ratio),
    findTabByFilePath: (filePath: string) => tabRepository.findTabByFilePath(filePath),
    getTabCount: () => tabRepository.getTabCount(),
    hasOpenFiles: () => tabRepository.hasOpenFiles(),
  }
}
