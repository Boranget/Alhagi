import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileTreeNodeType, DirectoryEntry } from '@/types'
import { FILE_TYPES } from '@electron-protocol/index'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useElectronApi } from '@/services/electron/ElectronApiService'

function emitFolderOpened(folderPath: string): void {
  eventBus.emit(AppEvents.FOLDER_OPENED, { folderPath })
}

const electronApi = useElectronApi()

export const useFileExplorerStore = defineStore('fileExplorer', () => {
  const currentFolder = ref<string | null>(null)
  const fileTree = ref<FileTreeNodeType[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function openFolder() {
    if (!electronApi.isAvailable()) {
      error.value = 'Electron API not available'
      return null
    }

    try {
      const response = await electronApi.openFolder()
      if (response && response.success && response.data) {
        currentFolder.value = response.data.path
        fileTree.value = response.data.tree as FileTreeNodeType[]
        
        const prefs = usePreferencesStore()
        const folderName = response.data.path.split(/[/\\]/).pop() || response.data.path
        prefs.addRecentFolder(response.data.path, folderName)
        emitFolderOpened(response.data.path)
        
        return response.data
      }
      return null
    } catch (e) {
      error.value = `Failed to open folder: ${e}`
      return null
    }
  }

  async function readDirectory(dirPath: string): Promise<FileTreeNodeType[]> {
    if (!electronApi.isAvailable()) return []

    try {
      const response = await electronApi.readDirectory(dirPath)
      if (!response || !response.success || !response.data) {
        return []
      }
      return response.data.map((entry: DirectoryEntry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.isDirectory ? FILE_TYPES.DIRECTORY : FILE_TYPES.FILE,
        expanded: false,
        children: entry.isDirectory ? [] : undefined
      }))
    } catch (e) {
      return []
    }
  }

  async function openFile(filePath: string) {
    if (!electronApi.isAvailable()) return null

    try {
      const response = await electronApi.readFile(filePath)
      if (response && response.success && response.data !== undefined) {
        return response.data
      }
      return null
    } catch (e) {
      error.value = `Failed to open file: ${e}`
      return null
    }
  }

  async function saveFile(filePath: string, content: string) {
    if (!electronApi.isAvailable()) return false

    try {
      const response = await electronApi.writeFile(filePath, content)
      return response && response.success
    } catch (e) {
      error.value = `Failed to save file: ${e}`
      return false
    }
  }

  async function createFile(dirPath: string, fileName: string) {
    if (!electronApi.isAvailable()) return null

    try {
      const filePath = `${dirPath}/${fileName}`
      const response = await electronApi.writeFile(filePath, '')
      if (response && response.success) {
        await refreshTree()
        return filePath
      }
      return null
    } catch (e) {
      error.value = `Failed to create file: ${e}`
      return null
    }
  }

  async function createDirectory(dirPath: string, dirName: string) {
    if (!electronApi.isAvailable()) return null

    try {
      const newDirPath = `${dirPath}/${dirName}`
      const response = await electronApi.writeFile(`${newDirPath}/.placeholder`, '')
      if (response && response.success) {
        await refreshTree()
        return newDirPath
      }
      return null
    } catch (e) {
      error.value = `Failed to create directory: ${e}`
      return null
    }
  }

  async function deleteFile(filePath: string) {
    if (!electronApi.isAvailable()) return false

    try {
      const response = await electronApi.deleteFile(filePath)
      if (response && response.success) {
        await refreshTree()
        return true
      }
      return false
    } catch (e) {
      error.value = `Failed to delete file: ${e}`
      return false
    }
  }

  async function renameFile(oldPath: string, newName: string) {
    if (!electronApi.isAvailable()) return null

    try {
      const dirPath = oldPath.substring(0, oldPath.lastIndexOf('/')) || oldPath.substring(0, oldPath.lastIndexOf('\\'))
      const newPath = `${dirPath}/${newName}`
      const copyResponse = await electronApi.copyFile(oldPath, newPath)
      if (!copyResponse || !copyResponse.success) {
        return null
      }
      const deleteResponse = await electronApi.deleteFile(oldPath)
      if (!deleteResponse || !deleteResponse.success) {
        return null
      }
      await refreshTree()
      return newPath
    } catch (e) {
      error.value = `Failed to rename file: ${e}`
      return null
    }
  }

  async function refreshTree() {
    if (!currentFolder.value) {
      return
    }

    isLoading.value = true
    try {
      const tree = await readDirectory(currentFolder.value)
      fileTree.value = tree
    } finally {
      isLoading.value = false
    }
  }

  async function openFolderByPath(folderPath: string) {
    if (!electronApi.isAvailable()) {
      error.value = 'Electron API not available'
      return null
    }

    try {
      const tree = await readDirectory(folderPath)
      currentFolder.value = folderPath
      fileTree.value = tree
      
      const prefs = usePreferencesStore()
      const folderName = folderPath.split(/[/\\]/).pop() || folderPath
      prefs.addRecentFolder(folderPath, folderName)
      emitFolderOpened(folderPath)
      
      return { path: folderPath, tree }
    } catch (e) {
      error.value = `Failed to open folder: ${e}`
      return null
    }
  }

  async function toggleFolder(node: FileTreeNodeType) {
    node.expanded = !node.expanded
    if (node.expanded && node.type === FILE_TYPES.DIRECTORY && (!node.children || node.children.length === 0)) {
      const children = await readDirectory(node.path)
      node.children = children
    }
  }

  return {
    currentFolder,
    fileTree,
    isLoading,
    error,
    openFolder,
    openFolderByPath,
    openFile,
    saveFile,
    createFile,
    createDirectory,
    deleteFile,
    renameFile,
    refreshTree,
    toggleFolder,
    readDirectory
  }
})