import type { ITabRepository } from '@core/interfaces/repositories/ITabRepository'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'
import type { Tab } from '@core/entities/Tab'

export class CloseTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(tabId: string): Promise<void> {
    const tab = this.tabRepository.getById(tabId)
    if (!tab) {
      return
    }

    this.tabRepository.delete(tabId)

    this.eventBus.emit('app:tab:closed', { tabId, tab: tab.toProps() as any })

    const activeTab = this.tabRepository.getActiveTab()
    if (activeTab) {
      this.eventBus.emit('app:tab:switched', {
        tabId: activeTab.id,
        previousTabId: tabId,
      })
    }
  }
}
