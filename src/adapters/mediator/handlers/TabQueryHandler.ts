import type { IQueryHandler } from '@core/domain/ports/IMediator'
import type { ITabQueries } from '@core/domain/ports/queries/ITabQueries'

export class TabQueryHandler implements IQueryHandler {
  constructor(private tabQueries: ITabQueries) {}

  execute(payload?: unknown): unknown {
    const query = payload as { type: string; id?: string; path?: string } | undefined
    if (!query) return this.tabQueries.getAll()

    switch (query.type) {
      case 'getAll': return this.tabQueries.getAll()
      case 'getById': return this.tabQueries.getById(query.id!)
      case 'getActive': return this.tabQueries.getActive()
      case 'getDirty': return this.tabQueries.getDirty()
      case 'findByPath': return this.tabQueries.findByPath(query.path!)
      case 'getCount': return this.tabQueries.getCount()
      case 'getOrder': return this.tabQueries.getOrder()
      case 'hasOpenFiles': return this.tabQueries.hasOpenFiles()
      default: return this.tabQueries.getAll()
    }
  }
}
