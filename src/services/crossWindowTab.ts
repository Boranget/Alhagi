import type { DetachedTabData } from '@electron-protocol/index'
import { useTabsStore } from '@/stores/tabs'
import { useTabActions } from '@/composables/useTabActions'
import { electronService } from '@/services/electron/ElectronService'

/**
 * 跨窗口标签恢复 + 传输回执（ack）。
 *
 * 恢复：消费 ElectronEventHandler 转发的 TAB.MERGE（拖到别的窗口边缘）/
 * TAB.DETACHED（分离到新窗口）携带的 tabData。幂等——目标窗口已打开
 * 同 filePath 的 tab 时只切换，不重复创建。
 *
 * 回执协议（防止"IPC 已送达但目标尚未建好"期间源窗口删除导致 tab 丢失）：
 *
 *   源窗口 mergeTab/createNewWindow 成功 → beginTabTransfer(tabId) 登记待删
 *   目标窗口 restoreDetachedTab 成功   → notifyTabMergeComplete 回发 ack
 *   源窗口收到 ack                     → confirmTabTransferred 才 closeTab
 *   超时（TRANSFER_ACK_TIMEOUT_MS）     → 放弃删除，保留源 tab
 *
 * 超时取舍：宁可双份 tab（用户可手动关），不可因目标失败/ack 丢失而丢数据。
 */

const TRANSFER_ACK_TIMEOUT_MS = 5000

const pendingTransfers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * 源窗口：拖出 tab 后登记"待确认删除"。
 * 目标窗口回发 ack 后由 confirmTabTransferred 真正 closeTab。
 */
export function beginTabTransfer(tabId: string): void {
  clearPendingTransfer(tabId)
  const timer = setTimeout(() => {
    pendingTransfers.delete(tabId)
    console.warn('[crossWindowTab] transfer ack timeout, keeping source tab:', tabId)
  }, TRANSFER_ACK_TIMEOUT_MS)
  pendingTransfers.set(tabId, timer)
}

/** 源窗口：收到目标窗口的 ack。仅当该 tab 仍在等待名单中才删除本地副本。 */
export async function confirmTabTransferred(originalTabId: string): Promise<void> {
  const timer = pendingTransfers.get(originalTabId)
  if (!timer) return // 非本窗口拖出的 tab，或已超时/已确认
  clearTimeout(timer)
  pendingTransfers.delete(originalTabId)

  const { closeTab } = useTabActions()
  await closeTab(originalTabId)
}

function clearPendingTransfer(tabId: string): void {
  const timer = pendingTransfers.get(tabId)
  if (timer) {
    clearTimeout(timer)
    pendingTransfers.delete(tabId)
  }
}

/** 目标窗口：恢复成功后向源窗口回发 ack（无 sourceWindowId 时静默跳过）。 */
function notifyMergeComplete(tabData: DetachedTabData): void {
  if (tabData.sourceWindowId == null) return
  electronService.notifyTabMergeComplete({
    sourceWindowId: tabData.sourceWindowId,
    originalTabId: tabData.id,
  })
}

/**
 * 目标窗口：把拖入的 tabData 恢复为本地 tab。
 * 成功（复用已有 tab 或新建）后回发 ack；失败不回发——
 * 源窗口超时后保留本地 tab，数据不丢失。
 */
export async function restoreDetachedTab(tabData: DetachedTabData): Promise<void> {
  try {
    const tabsStore = useTabsStore()

    if (tabData.filePath) {
      const existing = tabsStore.findTabByFilePath(tabData.filePath)
      if (existing) {
        tabsStore.switchTab(existing.id)
        notifyMergeComplete(tabData)
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
    notifyMergeComplete(tabData)
  } catch (error) {
    console.error('[crossWindowTab] restoreDetachedTab failed:', error)
  }
}
