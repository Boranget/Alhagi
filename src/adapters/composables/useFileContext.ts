import { storeToRefs } from 'pinia'
import { useFileExplorerStore } from '@/stores/fileExplorer'

export function useFileContext() {
  const store = useFileExplorerStore()
  const { currentFolder, fileTree, isLoading, error } = storeToRefs(store)

  return {
    currentFolder,
    fileTree,
    isLoading,
    error,
    openFolder: () => store.openFolder(),
    openFolderByPath: (path: string) => store.openFolderByPath(path),
    refreshTree: () => store.refreshTree(),
    toggleFolder: (node: import('@shared/types').FileTreeNodeType) => store.toggleFolder(node),
    createFile: (dirPath: string, fileName: string) => store.createFile(dirPath, fileName),
    createDirectory: (dirPath: string, dirName: string) => store.createDirectory(dirPath, dirName),
    deleteFile: (filePath: string) => store.deleteFile(filePath),
    renameFile: (oldPath: string, newName: string) => store.renameFile(oldPath, newName),
  }
}

export type FileContext = ReturnType<typeof useFileContext>
