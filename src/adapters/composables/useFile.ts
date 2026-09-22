import { OpenFile } from '@core/use-cases/file/OpenFile'
import { SaveFile } from '@core/use-cases/file/SaveFile'
import { CreateFile } from '@core/use-cases/file/CreateFile'
import { DeleteFile } from '@core/use-cases/file/DeleteFile'
import { useFileSystemGateway } from '@adapters/gateways/FileSystemGateway'
import { useTabsStore } from '@/stores/tabs'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'

export function useFile() {
  const fileSystem = useFileSystemGateway()
  const tabRepository = useTabsStore()
  const eventBus = useEventBusGateway()

  const openFile = new OpenFile(fileSystem, tabRepository, eventBus)
  const saveFile = new SaveFile(fileSystem, tabRepository, eventBus)
  const createFile = new CreateFile(fileSystem, eventBus)
  const deleteFile = new DeleteFile(fileSystem, tabRepository, eventBus)

  return {
    open: (options: { filePath?: string; folderPath?: string }) => openFile.execute(options),
    save: (tabId: string) => saveFile.execute(tabId),
    saveAs: (tabId: string, newPath: string) => saveFile.saveAs(tabId, newPath),
    create: (dirPath: string, fileName: string) => createFile.execute(dirPath, fileName),
    delete: (filePath: string) => deleteFile.execute(filePath),
  }
}
