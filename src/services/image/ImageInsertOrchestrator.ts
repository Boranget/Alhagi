// ============================================================
// Alhagi ImageInsertOrchestrator
// ============================================================
//
// 把「字节源 + 当前 tab/工作区/偏好」拼成 ctx，按 imageInsertMode 选策略，
// 返回 markdown 中的最终 path 字符串。
//
// 调用方：
//   - Crepe upload plugin uploader hook（粘贴/拖拽）→ resolveOnly（自己创建节点）
//   - 文件选择对话框（format.image 命令）→ insertFromFile（兼带写编辑器 + 标脏）
//   - 已知路径直插（如外部 API）→ insertByPath
//
// 设计要点：
//   - 单例（一份策略表 + 一次性 store 注入）
//   - 不持有任何运行时状态：策略类纯函数式，并发安全。竞争由调用方控制
//     （upload plugin 自身串行；菜单触发用户单次点击）

import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import {
  sourceFilename,
  type ImageInsertContext,
  type ImageInsertStrategy,
  type ImageInsertMode,
  type ImageSource,
} from './types'
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
   *
   * 接受 File 或 ImageSource：大文件从主进程原生 clipboard 拿到 base64 时
   * 直接传 `{base64, filename, mimeType}` 避免渲染端二次编码。
   */
  async resolveOnly(source: File | ImageSource, originalUrl?: string): Promise<string | null> {
    const activeTab = this.tabsStore.activeTab
    if (!activeTab) return null

    try {
      const ctx: ImageInsertContext = {
        source,
        originalUrl,
        tabId: activeTab.id,
        tabFilePath: activeTab.filePath ?? undefined,
        workspaceRoot: this.fileExplorerStore.currentFolder ?? undefined,
        storagePathTemplate: this.prefsStore.imageStoragePath || undefined,
      }
      const strategy = this.strategies[this.prefsStore.imageInsertMode]
      return await strategy.resolveFinalPath(ctx)
    } catch (error) {
      console.error('[ImageInsert] resolve failed:', error, 'filename:', sourceFilename(source))
      return null
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

// 单例
let instance: ImageInsertOrchestrator | null = null

export function useImageInsertOrchestrator(): ImageInsertOrchestrator {
  if (!instance) instance = new ImageInsertOrchestrator()
  return instance
}
