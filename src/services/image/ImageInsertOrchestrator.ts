// ============================================================
// Alhagi ImageInsertOrchestrator
// ============================================================
//
// 编排「事件源 → 上下文采集 → 策略派发 → 写入编辑器」全流程。
//
// 设计要点：
//   - Crepe 内置的 upload plugin 已经 handle paste/drop 事件；
//     crepeEditorManager 中 ctx.update(uploadConfig.key, ...) 把它的 uploader
//     覆盖为 orchestrator.resolveOnly，这是粘贴/拖拽走我们策略的唯一入口
//   - 文件选择对话框（菜单/命令面板的"插入图片"）直接调 insertFromFile
//   - inflight guard：兜底防止极少见的同步重入

import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import type { ImageInsertContext, ImageInsertStrategy, ImageInsertMode } from './types'
import { KeepOriginalStrategy } from './strategies/KeepOriginalStrategy'
import { CopyAbsoluteStrategy } from './strategies/CopyAbsoluteStrategy'
import { CopyRelativeStrategy } from './strategies/CopyRelativeStrategy'

export class ImageInsertOrchestrator {
  private readonly strategies: Record<ImageInsertMode, ImageInsertStrategy> = {
    'keep-original': new KeepOriginalStrategy(),
    'copy-absolute': new CopyAbsoluteStrategy(),
    'copy-relative': new CopyRelativeStrategy(),
  }

  private readonly tabsStore = useTabsStore()
  private readonly prefsStore = usePreferencesStore()
  private readonly fileExplorerStore = useFileExplorerStore()
  private readonly editorManager = useCrepeEditorManager()

  // 兜底 guard：极少见的同步重入。
  private inflight = false

  /** 文件选择对话框：插入单个文件（自己创建 PM 节点） */
  async insertFromFile(file: File, originalUrl?: string): Promise<string | null> {
    const finalPath = await this.resolveOnly(file, originalUrl)
    if (finalPath === null) return null
    const altText = file.name.replace(/\.[^.]+$/, '')
    this.editorManager.insertImage(finalPath, altText)
    const activeTab = this.tabsStore.activeTab
    if (activeTab) {
      this.tabsStore.updateTab(activeTab.id, {
        isDirty: true,
        lastModified: Date.now(),
      })
    }
    return finalPath
  }

  /**
   * 仅解析最终 path（写文件 + 应用策略），不写编辑器节点。
   * Crepe upload plugin 的 uploader hook 调用这个：upload plugin 自己负责
   * 创建占位符 → uploader 返回 PM 节点 → 替换占位符。
   */
  async resolveOnly(file: File, originalUrl?: string): Promise<string | null> {
    if (this.inflight) return null
    const activeTab = this.tabsStore.activeTab
    if (!activeTab) return null

    this.inflight = true
    try {
      const ctx: ImageInsertContext = {
        file,
        originalUrl,
        tabId: activeTab.id,
        tabFilePath: activeTab.filePath ?? undefined,
        workspaceRoot: this.fileExplorerStore.currentFolder ?? undefined,
        storagePathTemplate: this.prefsStore.imageStoragePath || undefined,
      }
      const strategy = this.strategies[this.prefsStore.imageInsertMode]
      return await strategy.resolveFinalPath(ctx)
    } catch (error) {
      console.error('[ImageInsert] resolve failed:', error)
      return null
    } finally {
      this.inflight = false
    }
  }

  /** 直接插入已有路径（无 IO） */
  insertByPath(imagePath: string, altText?: string): void {
    const activeTab = this.tabsStore.activeTab
    if (!activeTab) return
    const alt = altText || imagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'image'
    this.editorManager.insertImage(imagePath, alt)
    this.tabsStore.updateTab(activeTab.id, { isDirty: true, lastModified: Date.now() })
  }
}

// 单例：所有组件 / 命令共享同一份，inflight guard 才能起作用
let instance: ImageInsertOrchestrator | null = null

export function useImageInsertOrchestrator(): ImageInsertOrchestrator {
  if (!instance) instance = new ImageInsertOrchestrator()
  return instance
}
