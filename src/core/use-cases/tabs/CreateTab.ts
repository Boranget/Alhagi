import type { ITabRepository, CreateTabOptions } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { IElectronSync } from '@core/domain/ports/gateways/IElectronSync'
import type { TabState } from '@/types'
import { Tab } from '@core/entities/Tab'
import { generateUUID } from '@/utils/helpers'
import { detectFileType, createDefaultEditorState } from '@/utils/tabHelpers'
import { isLargeDocumentContent } from '@/utils/largeDocument'
import { TABS, EDITOR } from '@/constants'

export class CreateTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus,
    private electronSync: IElectronSync
  ) {}

  async execute(options: CreateTabOptions = {}): Promise<Tab> {
    // 1. 生成 ID
    const id = generateUUID()
    const filePath = options.filePath || null
    const fileType = options.fileType || detectFileType(filePath)
    const content = options.content || ''

    // 大文档强制源码模式：WYSIWYG 会为全文建 DOM，数 MB 的文件会卡死渲染进程。
    // 这里落库时就纠正 viewMode（含会话恢复传入的旧值），UI 与 EditorPool 才能一致。
    const requestedViewMode = options.viewMode || EDITOR.VIEW_MODES.WYSIWYG
    const viewMode = fileType === 'editor' && isLargeDocumentContent(content)
      ? EDITOR.VIEW_MODES.SOURCE
      : requestedViewMode

    // 2. 创建 Tab 实体
    const tab = new Tab({
      id,
      filePath,
      content,
      isDirty: false,
      title: options.title || this.generateUntitledTitle(),
      viewMode,
      splitRatio: options.splitRatio ?? 50,
      fileType,
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null,
      crepe: createDefaultEditorState(),
      codeMirror: createDefaultEditorState(),
    })

    // 3. 持久化
    this.tabRepository.insert(tab)

    // 4. 事件发送
    if (options.filePath) {
      this.eventBus.emit('app:file:opened', { filePath: options.filePath, tabId: id })
    }

    const previousTabId = this.tabRepository.getActiveTabId()
    this.tabRepository.setActiveTab(id)

    this.eventBus.emit('app:tab:created', { tabId: id, tab: tab.toProps() as TabState })

    if (previousTabId && previousTabId !== id) {
      this.eventBus.emit('app:tab:switched', { tabId: id, previousTabId })
    }

    // 5. Electron IPC 同步
    await this.syncOpenedFiles()

    return tab
  }

  private generateUntitledTitle(): string {
    const allTabs = this.tabRepository.getAll()
    const untitledCount = allTabs.filter(tab =>
      tab.title.startsWith(TABS.NEW_TAB_TITLE)
    ).length
    if (untitledCount === 0) {
      return TABS.NEW_TAB_TITLE
    }
    return `${TABS.NEW_TAB_TITLE}-${untitledCount}`
  }

  private async syncOpenedFiles(): Promise<void> {
    const allTabs = this.tabRepository.getAll()
    const filePaths = allTabs
      .map(tab => tab.filePath)
      .filter((filePath): filePath is string => filePath !== null)
    await this.electronSync.syncOpenedFiles(filePaths)
  }
}
