import { AppMediator } from './AppMediator'
import { useTabQueries } from './handlers/TabQueryAdapter'
import { TabQueries } from './commands'

let _mediator: AppMediator | null = null

export function getMediator(): AppMediator {
  if (!_mediator) {
    _mediator = new AppMediator()
    registerQueryHandlers(_mediator)
  }
  return _mediator
}

function registerQueryHandlers(mediator: AppMediator): void {
  const tabQueries = useTabQueries()

  // Register tab query handlers
  mediator.registerQuery(TabQueries.GET_ALL, {
    execute: () => tabQueries.getAll()
  })
  mediator.registerQuery(TabQueries.GET_BY_ID, {
    execute: (payload?: unknown) => tabQueries.getById((payload as { id: string }).id)
  })
  mediator.registerQuery(TabQueries.GET_ACTIVE, {
    execute: () => tabQueries.getActive()
  })
  mediator.registerQuery(TabQueries.GET_DIRTY, {
    execute: () => tabQueries.getDirty()
  })
  mediator.registerQuery(TabQueries.FIND_BY_PATH, {
    execute: (payload?: unknown) => tabQueries.findByPath((payload as { path: string }).path)
  })
  mediator.registerQuery(TabQueries.GET_COUNT, {
    execute: () => tabQueries.getCount()
  })
  mediator.registerQuery(TabQueries.GET_ORDER, {
    execute: () => tabQueries.getOrder()
  })
  mediator.registerQuery(TabQueries.HAS_OPEN_FILES, {
    execute: () => tabQueries.hasOpenFiles()
  })
}
