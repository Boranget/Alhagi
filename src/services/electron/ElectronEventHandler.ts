// ============================================================
// Alhagi Electron Event Handler - 主进程 → 渲染端事件桥
// ============================================================
//
// 经 P2-12 清理后，渲染端只订阅 4 类来自主进程的事件：
//
//   1. COMMAND.EXECUTE        主进程菜单 click 通知渲染端执行命令
//   2. FILE.EXTERNAL_CHANGED  打开文件被外部修改/删除
//   3. TAB.*                  跨窗口标签操作（合并/分离/聚焦）
//   4. WINDOW.DRAG_*          —— 未使用（保留 ElectronAPI 兼容由 preload 暴露，但本处不订阅）
//
// 其他历史菜单事件（onSave/onParagraph*/onTable* 等 50+ 个）在 P2-12 之后已无
// 主进程发送方——菜单点击全部走 COMMAND.EXECUTE，由命令系统 dispatcher 派发。

import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useTabService } from '@/services/tabService'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { toast } from '@/composables/useToast'
import { executeCommand } from '@/commands'
import type { ElectronAPI } from 'electron-protocol'

export class ElectronEventHandler {
  private disposables: (() => void)[] = []
  private readonly api: ElectronAPI | undefined
  private tabsStore: ReturnType<typeof useTabsStore>
  private tabService: ReturnType<typeof useTabService>
  private confirm: ReturnType<typeof useConfirmDialog>['confirm']

  constructor(api: ElectronAPI | undefined) {
    this.api = api
    this.tabsStore = useTabsStore()
    this.tabService = useTabService()
    this.confirm = useConfirmDialog().confirm
  }

  initialize(): void {
    if (!this.api) {
      console.warn('[ElectronEventHandler] Electron API not available, skipping initialization')
      return
    }

    this.registerCommandExecuteHandler()
    this.registerExternalFileChangeHandler()
    this.registerCrossWindowTabHandlers()
  }

  dispose(): void {
    for (const dispose of this.disposables) {
      try {
        dispose()
      } catch (error) {
        console.error('[ElectronEventHandler] dispose error:', error)
      }
    }
    this.disposables = []
  }

  private safeExecute(fn: () => void | Promise<void>, eventName: string): void {
    try {
      const result = fn()
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error(`[ElectronEventHandler] async error in ${eventName}:`, error)
        })
      }
    } catch (error) {
      console.error(`[ElectronEventHandler] error in ${eventName}:`, error)
    }
  }

  /**
   * 主进程菜单 click 通过 COMMAND.EXECUTE 通道送来 commandId，
   * 直接走 dispatcher.executeCommand 派发（与命令面板、快捷键收敛到同一路径）。
   */
  private registerCommandExecuteHandler(): void {
    this.disposables.push(
      this.api!.onExecuteCommand((commandId) => {
        this.safeExecute(async () => {
          await executeCommand(commandId)
        }, `onExecuteCommand:${commandId}`)
      })
    )
  }

  /**
   * 打开文件被外部修改/删除时弹提示。
   *   - modified：弹 confirm 让用户决定是否重载（脏 tab 额外说明会丢失修改）
   *   - deleted ：弹 alert + 标脏（不主动关 tab，避免误删）
   */
  private registerExternalFileChangeHandler(): void {
    this.disposables.push(
      this.api!.onExternalFileChanged(({ filePath, kind }) => {
        this.safeExecute(async () => {
          const tab = this.tabsStore.findTabByFilePath(filePath)
          if (!tab) return

          if (kind === 'deleted') {
            this.tabsStore.markDirty(tab.id)
            window.setTimeout(() => {
              toast.warning(`文件「${tab.title}」已被外部删除。\n标签内容仍可保存，会重新创建文件。`)
            }, 0)
            return
          }

          const shouldReload = await this.confirm({
            title: '外部文件变更',
            message: tab.isDirty
              ? `文件「${tab.title}」已被外部修改，但当前标签有未保存的更改。\n\n` +
                `点击「重新加载」从磁盘重新加载（丢弃当前修改）；点击「保留」保留当前修改。`
              : `文件「${tab.title}」已被外部修改。\n\n点击「重新加载」从磁盘重新加载；点击「保留」保留当前内容。`,
            confirmText: '重新加载',
            cancelText: '保留',
            danger: tab.isDirty,
          })

          if (shouldReload) {
            await this.tabService.reloadFromDisk(filePath)
          }
        }, `onExternalFileChanged:${filePath}`)
      })
    )
  }

  /**
   * 跨窗口标签操作通知：合并/分离/按文件聚焦。
   * 这些事件由 WindowManager 在窗口创建、tab 跨窗拖拽时发出，是渲染端
   * 唯一仍需要的主进程推送通道（其余菜单事件已统一走 COMMAND.EXECUTE）。
   */
  private registerCrossWindowTabHandlers(): void {
    this.disposables.push(
      this.api!.onTabMerge((tabData) => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.TAB_MERGE_REQUESTED, { tabData })
        }, 'onTabMerge')
      })
    )

    this.disposables.push(
      this.api!.onTabDetached((tabData) => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.TAB_DETACHED, { tabData })
        }, 'onTabDetached')
      })
    )

    this.disposables.push(
      this.api!.onFocusTabForFile((filePath) => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.FOCUS_TAB_FOR_FILE, { filePath })
        }, 'onFocusTabForFile')
      })
    )
  }
}
