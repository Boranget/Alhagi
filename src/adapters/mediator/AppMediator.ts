import type { IMediator, Command, Query, ICommandHandler, IQueryHandler } from '@core/domain/ports/IMediator'

export class AppMediator implements IMediator {
  private commandHandlers = new Map<string, ICommandHandler>()
  private queryHandlers = new Map<string, IQueryHandler>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerCommand(type: string, handler: ICommandHandler<any>): void {
    this.commandHandlers.set(type, handler)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerQuery(type: string, handler: IQueryHandler<any>): void {
    this.queryHandlers.set(type, handler)
  }

  async send<T>(command: Command<T>): Promise<T> {
    const handler = this.commandHandlers.get(command.type)
    if (!handler) throw new Error(`No handler for command: ${command.type}`)
    return handler.execute(command.payload) as T
  }

  query<T>(query: Query<T>): T {
    const handler = this.queryHandlers.get(query.type)
    if (!handler) throw new Error(`No handler for query: ${query.type}`)
    return handler.execute(query.payload) as T
  }
}
