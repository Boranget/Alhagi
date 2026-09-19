import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { TabUpdates } from '@core/domain/ports/repositories/ITabRepository'

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
