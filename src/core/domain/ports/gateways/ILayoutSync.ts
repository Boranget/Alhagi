export interface ILayoutSync {
  notifyLayoutChanged(payload: Record<string, unknown>): Promise<void>
}
