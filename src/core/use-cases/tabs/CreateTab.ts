import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { Tab } from '@core/entities/Tab'
import type { CreateTabOptions } from '@core/domain/ports/repositories/ITabRepository'

export class CreateTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(options?: CreateTabOptions): Promise<Tab> {
    const tab = this.tabRepository.create(options)
    // 事件由 Store 层的 createTab 负责 emit（TAB_CREATED, FILE_OPENED）
    return tab
  }
}
