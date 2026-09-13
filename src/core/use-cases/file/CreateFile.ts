import type { IFileSystem } from '@core/interfaces/gateways/IFileSystem'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'

export class CreateFile {
  constructor(
    private fileSystem: IFileSystem,
    private eventBus: IEventBus
  ) {}

  async execute(dirPath: string, fileName: string): Promise<string | null> {
    try {
      const filePath = `${dirPath}/${fileName}`
      await this.fileSystem.writeFile(filePath, '')
      return filePath
    } catch (error) {
      console.error('Failed to create file:', error)
      return null
    }
  }
}
