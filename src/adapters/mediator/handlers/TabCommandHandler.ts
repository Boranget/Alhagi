import type { ICommandHandler } from '@core/domain/ports/IMediator'
import { useTabsStore } from '@/stores/tabs'
import { getCreateTabUseCase, getCloseTabUseCase, getSwitchTabUseCase, getUpdateTabUseCase } from '@adapters/commandHandlers'

export class TabCommandHandler {
  private store = useTabsStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type, ...params } = payload as { type: string; [k: string]: any }
    switch (type) {
      case 'tab:create':
        return getCreateTabUseCase().execute(params)
      case 'tab:close':
        return getCloseTabUseCase().execute(params.tabId)
      case 'tab:switch':
        return getSwitchTabUseCase().execute(params.tabId)
      case 'tab:update':
        return getUpdateTabUseCase().execute(params.tabId, params.patch)
      case 'tab:markDirty':
        return this.store.markDirty(params.tabId)
      case 'tab:markClean':
        return this.store.markClean(params.tabId)
      case 'tab:setViewMode':
        return this.store.setViewMode(params.tabId, params.mode)
      case 'tab:remove':
        // 与 tab:close 同语义：必须走 CloseTab —— 处理 activeTabId 邻居切换、
        // app:tab:closed / app:tab:switched 事件与 opened-files IPC 同步。
        // 直接 store.removeTabById 会让批量关闭（关闭其他/已保存/全部）留下悬空 activeTabId。
        return getCloseTabUseCase().execute(params.tabId)
      default:
        throw new Error(`Unknown tab command: ${type}`)
    }
  }
}
