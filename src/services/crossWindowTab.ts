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
 *   源窗口 beginTabTransfer(tabId) 先登记（必须早于 merge IPC，防 ack 抢跑）
 *   目标窗口 restoreDetachedTab 成功且内容安全 → 回发 ack
 *     （同 filePath 冲突且源侧未落盘 → 不回发，见 restoreDetachedTab 注释）
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
 * 必须在发起 merge IPC **之前**登记：ack 可能先于 IPC 返回到达，
 * 后登记会把 ack 吞掉（confirm 查不到 timer → 源 tab 永不关闭 → 双份）。
 */
export function beginTabTransfer(tabId: string): void {
  cancelTabTransfer(tabId)
  const timer = setTimeout(() => {
    pendingTransfers.delete(tabId)
    console.warn('[crossWindowTab] transfer ack timeout, keeping source tab:', tabId)
  }, TRANSFER_ACK_TIMEOUT_MS)
  pendingTransfers.set(tabId, timer)
}

/** 源窗口：merge 创建失败时撤销登记（残留 timer 会在 5s 后误告警）。 */
export function cancelTabTransfer(tabId: string): void {
  const timer = pendingTransfers.get(tabId)
  if (timer) {
    clearTimeout(timer)
    pendingTransfers.delete(tabId)
  }
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
 * 成功（复用已有 tab 或新建）后回发 ack；失败/冲突不回发——
 * 源窗口超时后保留本地 tab，数据不丢失。
 *
 * ack 的语义是"源窗口可以删本地副本了"——**绝不允许在丢弃
 * 未落盘内容时回发**。同 filePath 已打开时分三支：
 *   内容一致   → 复用 + ack，源侧 dirty 随内容交接给本地 tab
 *   内容不同且源侧 clean → 源内容已在磁盘上，本地编辑保留 + ack
 *   内容不同且源侧 dirty → 真冲突：不 ack（源侧超时保留，两侧都不丢）
 */
export async function restoreDetachedTab(tabData: DetachedTabData): Promise<void> {
  try {
    const tabsStore = useTabsStore()

    if (tabData.filePath) {
      const existing = tabsStore.findTabByFilePath(tabData.filePath)
      if (existing) {
        if (existing.content === tabData.content) {
          tabsStore.switchTab(existing.id)
          if (tabData.isDirty && !existing.isDirty) {
            tabsStore.updateTab(existing.id, { isDirty: true })
          }
          notifyMergeComplete(tabData)
          return
        }
        if (!tabData.isDirty) {
          tabsStore.switchTab(existing.id)
          notifyMergeComplete(tabData)
          return
        }
        console.warn('[crossWindowTab] unsaved conflict, refusing merge:', tabData.filePath)
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
