import type { IFileSystem } from '@core/interfaces/gateways/IFileSystem'
import type { ITabRepository } from '@core/interfaces/repositories/ITabRepository'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'

export class SaveFile {
  constructor(
    private fileSystem: IFileSystem,
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(tabId: string): Promise<boolean> {
    const tab = this.tabRepository.getById(tabId)
    if (!tab || !tab.filePath) {
      return false
    }

    try {
      await this.fileSystem.writeFile(tab.filePath, tab.content)
      this.tabRepository.markClean(tabId)
      this.eventBus.emit('app:file:saved', { filePath: tab.filePath, tabId })
      return true
    } catch (error) {
      console.error('Failed to save file:', error)
      return false
    }
  }

  async saveAs(tabId: string, newPath: string): Promise<boolean> {
    const tab = this.tabRepository.getById(tabId)
    if (!tab) {
      return false
    }

    try {
      await this.fileSystem.writeFile(newPath, tab.content)
      this.tabRepository.update(tabId, { filePath: newPath } as any)
      this.tabRepository.markClean(tabId)
      this.eventBus.emit('app:file:saved', { filePath: newPath, tabId })
      return true
    } catch (error) {
      console.error('Failed to save file as:', error)
      return false
    }
  }
}
