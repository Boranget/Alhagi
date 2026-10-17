import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { IElectronSync } from '@core/domain/ports/gateways/IElectronSync'
import type { TabState } from '@/types'

export class CloseTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus,
    private electronSync: IElectronSync
  ) {}

  async execute(tabId: string): Promise<void> {
    const tab = this.tabRepository.getById(tabId)
    if (!tab) return

    const currentIndex = this.tabRepository.getTabOrder().indexOf(tabId)
    if (currentIndex === -1) return

    // 1. 删除 tab
    this.tabRepository.delete(tabId)

    // 2. 事件发送
    this.eventBus.emit('app:tab:closed', { tabId, tab: tab.toProps() as TabState })

    // 3. 切换到邻居 tab
    if (this.tabRepository.getActiveTabId() === tabId) {
      const tabOrder = this.tabRepository.getTabOrder()
      if (tabOrder.length > 0) {
        const rightIndex = currentIndex
        const leftIndex = currentIndex - 1

        let nextTabId: string | null = null
        if (rightIndex < tabOrder.length) {
          nextTabId = tabOrder[rightIndex]
        } else if (leftIndex >= 0) {
          nextTabId = tabOrder[leftIndex]
        }

        if (nextTabId) {
          this.tabRepository.setActiveTab(nextTabId)
          this.eventBus.emit('app:tab:switched', { tabId: nextTabId, previousTabId: tabId })
        } else {
          this.tabRepository.setActiveTab('')
        }
      } else {
        this.tabRepository.setActiveTab('')
      }
    }

    // 4. Electron IPC 同步
    await this.syncOpenedFiles()
  }

  private async syncOpenedFiles(): Promise<void> {
    const allTabs = this.tabRepository.getAll()
    const filePaths = allTabs
      .map(tab => tab.filePath)
      .filter((filePath): filePath is string => filePath !== null)
    await this.electronSync.syncOpenedFiles(filePaths)
  }
}
