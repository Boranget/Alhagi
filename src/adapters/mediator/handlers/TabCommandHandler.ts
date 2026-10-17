import type { ICommandHandler } from '@core/domain/ports/IMediator'
import type { CreateTabOptions, TabUpdates } from '@core/domain/ports/repositories/ITabRepository'
import type { ViewMode } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { getCreateTabUseCase, getCloseTabUseCase, getSwitchTabUseCase, getUpdateTabUseCase } from '@adapters/commandHandlers'

export class TabCommandHandler {
  private store = useTabsStore()

  async execute(payload?: unknown): Promise<unknown> {
    // 命令 payload 在中介者边界是动态的；各 case 按实际消费字段收窄
    const { type, ...rest } = payload as { type: string; [k: string]: unknown }
    switch (type) {
      case 'tab:create':
        return getCreateTabUseCase().execute(rest as CreateTabOptions)
      case 'tab:close':
        return getCloseTabUseCase().execute(rest.tabId as string)
      case 'tab:switch':
        return getSwitchTabUseCase().execute(rest.tabId as string)
      case 'tab:update':
        return getUpdateTabUseCase().execute(rest.tabId as string, rest.patch as Partial<TabUpdates>)
      case 'tab:markDirty':
        return this.store.markDirty(rest.tabId as string)
      case 'tab:markClean':
        return this.store.markClean(rest.tabId as string)
      case 'tab:setViewMode':
        return this.store.setViewMode(rest.tabId as string, rest.mode as ViewMode)
      case 'tab:remove':
        // 与 tab:close 同语义：必须走 CloseTab —— 处理 activeTabId 邻居切换、
        // app:tab:closed / app:tab:switched 事件与 opened-files IPC 同步。
        // 直接 store.removeTabById 会让批量关闭（关闭其他/已保存/全部）留下悬空 activeTabId。
        return getCloseTabUseCase().execute(rest.tabId as string)
      default:
        throw new Error(`Unknown tab command: ${type}`)
    }
  }
}
