import type { IFileSystem } from '@core/interfaces/gateways/IFileSystem'
import type { ITabRepository } from '@core/interfaces/repositories/ITabRepository'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'

export class DeleteFile {
  constructor(
    private fileSystem: IFileSystem,
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(filePath: string): Promise<boolean> {
    try {
      await this.fileSystem.delete(filePath)

      const tab = this.tabRepository.findTabByFilePath(filePath)
      if (tab) {
        this.tabRepository.delete(tab.id)
        this.eventBus.emit('app:tab:closed', { tabId: tab.id, tab: tab.toProps() as any })
      }

      return true
    } catch (error) {
      console.error('Failed to delete file:', error)
      return false
    }
  }
}
