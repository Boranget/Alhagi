export interface Command<T = void> {
  readonly type: string
  readonly payload?: unknown
}

export interface Query<T = void> {
  readonly type: string
  readonly payload?: unknown
}

export interface ICommandHandler<T = void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(payload?: any): Promise<T> | T
}

export interface IQueryHandler<T = void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(payload?: any): T
}

export interface IMediator {
  send<T>(command: Command<T>): Promise<T>
  query<T>(query: Query<T>): T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerCommand(type: string, handler: ICommandHandler<any>): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerQuery(type: string, handler: IQueryHandler<any>): void
}
