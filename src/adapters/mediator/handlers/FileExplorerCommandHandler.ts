import type { ICommandHandler } from '@core/domain/ports/IMediator'
import type { FileTreeNodeType } from '@/types'
import { useFileExplorerStore } from '@/stores/fileExplorer'

/** 命令 payload 在中介者边界是动态的；按各 case 实际消费的字段声明 */
interface FileExplorerCommandParams {
  folderPath: string
  node: FileTreeNodeType
  dirPath: string
  fileName: string
  dirName: string
  filePath: string
  oldPath: string
  newName: string
}

export class FileExplorerCommandHandler {
  private store = useFileExplorerStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type, ...params } = payload as { type: string } & FileExplorerCommandParams
    switch (type) {
      case 'file:openFolder':
        return this.store.openFolder()
      case 'file:openFolderByPath':
        return this.store.openFolderByPath(params.folderPath)
      case 'file:refreshTree':
        return this.store.refreshTree()
      case 'file:toggleFolder':
        return this.store.toggleFolder(params.node)
      case 'file:createFile':
        return this.store.createFile(params.dirPath, params.fileName)
      case 'file:createDirectory':
        return this.store.createDirectory(params.dirPath, params.dirName)
      case 'file:deleteFile':
        return this.store.deleteFile(params.filePath)
      case 'file:renameFile':
        return this.store.renameFile(params.oldPath, params.newName)
      default:
        throw new Error(`Unknown fileExplorer command: ${type}`)
    }
  }
}
