import type { ITabRepository } from '@core/interfaces/repositories/ITabRepository'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'
import type { TabUpdates } from '@core/interfaces/repositories/ITabRepository'

export class UpdateTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(tabId: string, updates: Partial<TabUpdates>): Promise<void> {
    const tab = this.tabRepository.getById(tabId)
    if (!tab) {
      return
    }

    this.tabRepository.update(tabId, updates)

    this.eventBus.emit('app:tab:updated', { tabId, updates })
  }
}
