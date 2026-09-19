// ============================================================
// EditorServiceGateway — 编辑器服务网关（薄代理）
// ============================================================
//
// 委托给 MilkdownAdapter，不包含任何 Milkdown 特定逻辑。
// 实现 IEditorProvider 接口（不再实现旧的 IEditorService）。

import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import { MilkdownAdapter } from '@infrastructure/adapters/editors/MilkdownAdapter'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import { ImageStorageGateway } from '@adapters/gateways/image/ImageStorageGateway'
import { useFileSystemGateway } from '@adapters/gateways/FileSystemGateway'
import { usePreferencesStore } from '@/stores/preferences'
import { useTabsStore } from '@/stores/tabs'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'

export class EditorServiceGateway implements IEditorProvider {
  private adapter: MilkdownAdapter

  constructor() {
    // Initialize dependencies for MilkdownAdapter
    const tabsStore = useTabsStore()
    const prefsStore = usePreferencesStore()
    const fileSystemGateway = useFileSystemGateway()
    const imageStorageGateway = new ImageStorageGateway(fileSystemGateway)
    const imageInsertService = new ImageInsertService(imageStorageGateway)

    const getCurrentFilePath = () => tabsStore.activeTab?.filePath ?? undefined
    const getCurrentFileDir = () => {
      const path = tabsStore.activeTab?.filePath
      if (!path) return undefined
      const lastSlash = path.lastIndexOf('/')
      const lastBackslash = path.lastIndexOf('\\')
      const lastSep = Math.max(lastSlash, lastBackslash)
      return lastSep > 0 ? path.substring(0, lastSep) : undefined
    }
    const getImageOptions = (): ImageInsertOptions => {
      const baseOptions = ImageInsertOptions.createDefault()
      // Override with user preferences
      return new ImageInsertOptions({
        ...baseOptions.toProps(),
        mode: prefsStore.imageInsertMode,
        copyPath: prefsStore.imageCopyPath,
        preferRelativePath: prefsStore.imagePreferRelativePath,
        applyToLocal: prefsStore.imageApplyToLocal,
        applyToRemote: prefsStore.imageApplyToRemote,
        escapeUrl: prefsStore.imageEscapeUrl,
      })
    }
    const getImageContext = (): ImageInsertContext => ({
      currentFilePath: tabsStore.activeTab?.filePath ?? undefined,
      currentFileDir: getCurrentFileDir(),
      fileName: undefined,
      editorInsertImage: (url: string, alt?: string) => {
        this.adapter.insertImage(url, alt || '')
      },
    })

    this.adapter = new MilkdownAdapter(
      getCurrentFilePath,
      getCurrentFileDir,
      imageInsertService,
      getImageOptions,
      getImageContext
    )
  }

  // 生命周期
  async init(container: HTMLElement, content: string, tabId: string): Promise<void> {
    console.log('[EditorServiceGateway] init called', { tabId, contentLength: content.length })
    return this.adapter.init(container, content, tabId)
  }

  async destroy(): Promise<void> {
    return this.adapter.destroy()
  }

  isReady(): boolean {
    return this.adapter.isReady()
  }

  // 内容操作
  getMarkdown(): string {
    return this.adapter.getMarkdown()
  }

  async setMarkdown(content: string): Promise<void> {
    return this.adapter.setMarkdown(content)
  }

  getHTML(): string {
    return this.adapter.getHTML()
  }

  // 视图模式
  setViewMode(mode: 'wysiwyg' | 'source' | 'split'): void {
    return this.adapter.setViewMode(mode)
  }

  getViewMode(): 'wysiwyg' | 'source' | 'split' {
    return this.adapter.getViewMode()
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.adapter.getActiveEditor()
  }

  getView(): any | null {
    return this.adapter.getView()
  }

  // 导航
  scrollToHeading(pos: number): void {
    return this.adapter.scrollToHeading(pos)
  }

  // 事件订阅
  onContentChange(callback: (markdown: string) => void): () => void {
    return this.adapter.onContentChange(callback)
  }

  onCursorChange(callback: (from: number, to: number) => void): () => void {
    return this.adapter.onCursorChange(callback)
  }

  // 状态查询
  getSelection(): { from: number; to: number } | null {
    return this.adapter.getSelection()
  }

  getHeadings(): Array<{ text: string; level: number; line: number; pos: number }> {
    return this.adapter.getHeadings()
  }

  // 缓存管理
  getCachedContent(tabId: string): string | undefined {
    return this.adapter.getCachedContent(tabId)
  }

  setCachedContent(tabId: string, content: string): void {
    this.adapter.setCachedContent(tabId, content)
  }

  clearCache(): void {
    this.adapter.clearCache()
  }
}

// 单例工厂（由 DI 容器管理实例）
let gatewayInstance: EditorServiceGateway | null = null

export function initializeEditorGateway(): void {
  if (gatewayInstance) return
  gatewayInstance = new EditorServiceGateway()
}

export function setEditorServiceGateway(instance: EditorServiceGateway): void {
  gatewayInstance = instance
}

export function getEditorServiceGateway(): EditorServiceGateway {
  if (!gatewayInstance) {
    throw new Error('EditorServiceGateway not initialized. Call initializeEditorGateway() first.')
  }
  return gatewayInstance
}