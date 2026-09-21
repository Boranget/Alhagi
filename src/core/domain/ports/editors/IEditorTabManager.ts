import type { ViewMode } from '@shared/types'

export interface IEditorTabManager {
  createTab(tabId: string, content: string, viewMode?: ViewMode): Promise<void>
  destroyTab(tabId: string): Promise<void>
  switchTab(tabId: string): void
  hasTab(tabId: string): boolean
}
