import type { DetachedTabData } from '@electron-protocol/index'
import { useTabsStore } from '@/stores/tabs'
import { useTabActions } from '@/composables/useTabActions'

/**
 * 跨窗口标签恢复。
 *
 * 消费 ElectronEventHandler 转发的 TAB.MERGE（拖到别的窗口边缘）/
 * TAB.DETACHED（分离到新窗口）携带的 tabData。源窗口在 IPC 成功后
 * 会走 CloseTab 删除本地 tab，因此本函数是数据不丢失的唯一保障。
 *
 * 幂等：目标窗口已打开同 filePath 的 tab（含 last-session 恢复出的
 * 重复项）时只切换，不重复创建。
 */
export async function restoreDetachedTab(tabData: DetachedTabData): Promise<void> {
  try {
    const tabsStore = useTabsStore()

    if (tabData.filePath) {
      const existing = tabsStore.findTabByFilePath(tabData.filePath)
      if (existing) {
        tabsStore.switchTab(existing.id)
        return
      }
    }

    const { createTab } = useTabActions()
    const tab = await createTab({
      title: tabData.title,
      content: tabData.content,
      filePath: tabData.filePath ?? undefined,
      viewMode: tabData.viewMode as 'wysiwyg' | 'source' | 'split',
    })

    if (tabData.isDirty) {
      tabsStore.updateTab(tab.id, { isDirty: true })
    }
  } catch (error) {
    console.error('[crossWindowTab] restoreDetachedTab failed:', error)
  }
}
