import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'

export class InitEditor {
  constructor(
    private editorProvider: IEditorProvider,
    private eventBus: IEventBus,
    private tabRepository: ITabRepository
  ) {}

  async execute(container: HTMLElement, content: string = '', tabId: string): Promise<void> {
    console.log('[InitEditor] execute called', { tabId, contentLength: content.length })

    // 初始化编辑器，传入内容
    await this.editorProvider.init(container, content, tabId)

    // 订阅内容变更
    this.editorProvider.onContentChange((markdown) => {
      console.log('[InitEditor] onContentChange callback fired', { tabId, markdownLength: markdown.length })
      
      // 更新 tab 内容并标记为脏
      this.tabRepository.update(tabId, {
        content: markdown,
        isDirty: true,
        lastModified: Date.now(),
      })

      this.eventBus.emit('editor:content:changed', { content: markdown, tabId })
    })

    this.eventBus.emit('app:editor:ready', { tabId })
  }
}