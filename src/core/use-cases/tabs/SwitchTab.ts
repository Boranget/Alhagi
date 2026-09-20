import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'

export class SwitchTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(tabId: string): Promise<void> {
    const currentTab = this.tabRepository.getActiveTab()
    if (currentTab?.id === tabId) return

    const previousTabId = currentTab?.id
    this.tabRepository.setActiveTab(tabId)
    // 事件由 Store 层的 switchTab 负责 emit，此处不再重复
  }
}
