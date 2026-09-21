import type { CommandHandler } from '../types'
import { getDispatcher } from '../dispatcher'
import { useTabsStore } from '@/stores/tabs'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { electronService } from '@/services/electron/ElectronService'
import { useTabService } from '@/services/tabService'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { getCreateTabUseCase, getCloseTabUseCase } from '@adapters/commandHandlers'

export function registerFileHandlers(dispatcher: ReturnType<typeof getDispatcher>): void {
  const tabsStore = useTabsStore()
  const fileStore = useFileExplorerStore()
  const tabService = useTabService()
  const { confirm } = useConfirmDialog()
  const createTabUseCase = getCreateTabUseCase()
  const closeTabUseCase = getCloseTabUseCase()

  const handlers: Record<string, CommandHandler> = {
    'file.new': async () => {
      await createTabUseCase.execute({ title: '未命名' })
    },

    'file.newWindow': () => {
      electronService.getAPI()?.executeMainCommand('file.newWindow')
    },

    'file.open': () => {
      tabService.openFile()
    },

    'file.openFolder': async () => {
      await fileStore.openFolder()
    },

    'file.save': () => {
      if (tabsStore.activeTabId) {
        tabService.saveFile(tabsStore.activeTabId)
      }
    },

    'file.saveAs': () => {
      if (tabsStore.activeTabId) {
        tabService.saveFileAs(tabsStore.activeTabId)
      }
    },

    'file.close': async () => {
      const tabId = tabsStore.activeTabId
      if (!tabId) return

      const tab = tabsStore.tabs.get(tabId)
      if (tab?.isDirty) {
        const ok = await confirm({
          title: '未保存的更改',
          message: `文件 "${tab.title}" 有未保存的更改，确定要关闭吗？`,
          confirmText: '关闭',
          cancelText: '取消',
          danger: true,
        })
        if (!ok) return
      }

      await closeTabUseCase.execute(tabId)
    },
  }

  dispatcher.registerBatch(handlers)
}
