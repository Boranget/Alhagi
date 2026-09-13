import type { IFileSystem } from '@core/interfaces/gateways/IFileSystem'
import type { ITabRepository } from '@core/interfaces/repositories/ITabRepository'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'
import type { Tab } from '@core/entities/Tab'

export interface OpenFileOptions {
  filePath?: string
  folderPath?: string
}

export class OpenFile {
  constructor(
    private fileSystem: IFileSystem,
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(options: OpenFileOptions): Promise<Tab | null> {
    if (options.filePath) {
      return this.openFile(options.filePath)
    }

    if (options.folderPath) {
      await this.openFolder(options.folderPath)
      return null
    }

    return null
  }

  private async openFile(filePath: string): Promise<Tab> {
    const existingTab = this.tabRepository.findTabByFilePath(filePath)
    if (existingTab) {
      this.tabRepository.setActiveTab(existingTab.id)
      this.eventBus.emit('app:tab:switched', {
        tabId: existingTab.id,
        previousTabId: this.tabRepository.getActiveTab()?.id,
      })
      return existingTab
    }

    const content = await this.fileSystem.readFile(filePath)
    const fileName = filePath.split(/[/\\]/).pop() || '无标题'

    const tab = this.tabRepository.create({
      filePath,
      title: fileName,
      content,
    })

    this.tabRepository.setActiveTab(tab.id)

    this.eventBus.emit('app:tab:created', { tabId: tab.id, tab: tab.toProps() as any })
    this.eventBus.emit('app:file:opened', { filePath, tabId: tab.id })

    return tab
  }

  private async openFolder(folderPath: string): Promise<void> {
    this.eventBus.emit('app:folder:opened', { folderPath })
  }
}
