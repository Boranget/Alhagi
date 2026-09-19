import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'

export class SwitchTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(tabId: string): Promise<void> {
    const currentTab = this.tabRepository.getActiveTab()
    const previousTabId = currentTab?.id

    this.tabRepository.setActiveTab(tabId)

    this.eventBus.emit('app:tab:switched', {
      tabId,
      previousTabId,
    })
  }
}
