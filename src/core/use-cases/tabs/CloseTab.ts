import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
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
    // 事件由 Store 层的 removeTab 负责 emit（TAB_CLOSED, TAB_SWITCHED）
  }
}
