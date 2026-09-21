export interface IEditorLifecycle {
  initWrapper(wrapper: HTMLElement): Promise<void>
  detach(): Promise<void>
  destroy(): Promise<void>
  isReady(tabId?: string): boolean
}
