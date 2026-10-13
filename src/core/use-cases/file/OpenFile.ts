import type { IFileSystem } from '@core/domain/ports/gateways/IFileSystem'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { Tab } from '@core/entities/Tab'
import type { CreateTab } from '@core/use-cases/tabs/CreateTab'

export interface OpenFileOptions {
  filePath?: string
  folderPath?: string
}

export class OpenFile {
  constructor(
    private fileSystem: IFileSystem,
    private tabRepository: ITabRepository,
    private eventBus: IEventBus,
    private createTab: CreateTab
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
      const previousTabId = this.tabRepository.getActiveTabId()
      this.tabRepository.setActiveTab(existingTab.id)
      if (previousTabId && previousTabId !== existingTab.id) {
        this.eventBus.emit('app:tab:switched', {
          tabId: existingTab.id,
          previousTabId,
        })
      }
      return existingTab
    }

    const content = await this.fileSystem.readFile(filePath)
    const fileName = filePath.split(/[/\\]/).pop() || '无标题'

    // tabRepository.create 是「必须走 CreateTab Use Case」的故意守卫，
    // 这里委托给 CreateTab：insert、活动切换、事件、Electron opened-files 同步。
    return this.createTab.execute({ filePath, title: fileName, content })
  }

  private async openFolder(folderPath: string): Promise<void> {
    this.eventBus.emit('app:folder:opened', { folderPath })
  }
}
