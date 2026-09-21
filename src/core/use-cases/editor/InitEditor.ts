import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'

export class InitEditor {
  private unsubscribeContentChange: (() => void) | null = null

  constructor(
    private editorProvider: IEditorProvider,
    private eventBus: IEventBus,
    private tabRepository: ITabRepository
  ) {}

  async execute(_container: HTMLElement, content: string = '', tabId: string): Promise<void> {
    console.log('[InitEditor] execute called', { tabId, contentLength: content.length })

    // 先取消旧的订阅，防止 handler 累积
    if (this.unsubscribeContentChange) {
      this.unsubscribeContentChange()
      this.unsubscribeContentChange = null
      console.log('[InitEditor] unsubscribed old contentChange handler')
    }

    // 使用多实例 API：创建 tab 编辑器实例并切换
    if (!this.editorProvider.hasTab(tabId)) {
      await this.editorProvider.createTab(tabId, content)
    }
    this.editorProvider.switchTab(tabId)

    // 订阅内容变更 — 使用当前活动 tab 而非闭包捕获的初始 tabId
    this.unsubscribeContentChange = this.editorProvider.onContentChange((markdown) => {
      const activeTabId = this.tabRepository.getActiveTabId()
      console.log('[InitEditor] onContentChange: activeTabId=' + activeTabId + ', length=' + markdown.length)

      if (!activeTabId) return

      this.tabRepository.update(activeTabId, {
        content: markdown,
        isDirty: true,
        lastModified: Date.now(),
      })

      this.eventBus.emit('editor:content:changed', { content: markdown, tabId: activeTabId })
    })

    console.log('[InitEditor] subscribed to contentChange', { tabId, hasUnsubscribe: typeof this.unsubscribeContentChange === 'function' })
    this.eventBus.emit('app:editor:ready', { tabId })
  }
}
