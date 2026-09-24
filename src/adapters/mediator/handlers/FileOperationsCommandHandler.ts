import { useTabsStore } from '@/stores/tabs'
import { electronService } from '@/services/electron/ElectronService'
import { useTabService } from '@/services/tabService'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { getCloseTabUseCase } from '@adapters/commandHandlers'

export class FileOperationsCommandHandler {
  private tabsStore = useTabsStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }
    switch (type) {
      case 'file:newWindow':
        electronService.getAPI()?.executeMainCommand('file.newWindow')
        return
      case 'file:open':
        return useTabService().openFile()
      case 'file:save': {
        const tabId = this.tabsStore.activeTabId
        if (tabId) return useTabService().saveFile(tabId)
        return
      }
      case 'file:saveAs': {
        const tabId = this.tabsStore.activeTabId
        if (tabId) return useTabService().saveFileAs(tabId)
        return
      }
      case 'file:closeActive': {
        const tabId = this.tabsStore.activeTabId
        if (!tabId) return

        const tab = this.tabsStore.tabs.get(tabId)
        if (tab?.isDirty) {
          const { confirm } = useConfirmDialog()
          const ok = await confirm({
            title: '未保存的更改',
            message: `文件 "${tab.title}" 有未保存的更改，确定要关闭吗？`,
            confirmText: '关闭',
            cancelText: '取消',
            danger: true,
          })
          if (!ok) return
        }

        return getCloseTabUseCase().execute(tabId)
      }
      default:
        throw new Error(`Unknown file command: ${type}`)
    }
  }
}
