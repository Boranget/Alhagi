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

    this.eventBus.emit('app:tab:created', { tabId: tab.id, tab: tab.toProps() as any })

    if (options?.filePath) {
      this.eventBus.emit('app:file:opened', { filePath: options.filePath, tabId: tab.id })
    }

    return tab
  }
}
