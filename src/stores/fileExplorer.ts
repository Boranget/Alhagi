import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileTreeNodeType, DirectoryEntry } from '@/types'
import { FILE_TYPES } from '../../electron-protocol'
import { usePreferencesStore } from '@/stores/preferences'

export const useFileExplorerStore = defineStore('fileExplorer', () => {
  const currentFolder = ref<string | null>(null)
  const fileTree = ref<FileTreeNodeType[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function openFolder() {
    if (!window.electronAPI) {
      error.value = 'Electron API not available'
      return null
    }

    try {
      const response = await window.electronAPI.openFolder()
      if (response && response.success && response.data) {
        currentFolder.value = response.data.path
        fileTree.value = response.data.tree
        
        const prefs = usePreferencesStore()
        const folderName = response.data.path.split(/[/\\]/).pop() || response.data.path
        prefs.addRecentFolder(response.data.path, folderName)
        
        return response.data
      }
      return null
    } catch (e) {
      error.value = `Failed to open folder: ${e}`
      console.error('[FileExplorerStore] Error opening folder:', e)
      return null
    }
  }

  async function readDirectory(dirPath: string): Promise<FileTreeNodeType[]> {
    if (!window.electronAPI) return []

    try {
      const response = await window.electronAPI.readDirectory(dirPath)
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
      console.error('Failed to read directory:', e)
      return []
    }
  }

  async function openFile(filePath: string) {
    if (!window.electronAPI) return null

    try {
      const response = await window.electronAPI.readFile(filePath)
      if (response && response.success && response.data) {
        return response.data
      }
      return null
    } catch (e) {
      error.value = `Failed to open file: ${e}`
      return null
    }
  }

  async function saveFile(filePath: string, content: string) {
    if (!window.electronAPI) return false

    try {
      const response = await window.electronAPI.saveFile(filePath, content)
      return response && response.success
    } catch (e) {
      error.value = `Failed to save file: ${e}`
      return false
    }
  }

  async function createFile(dirPath: string, fileName: string) {
    if (!window.electronAPI) return null

    try {
      const response = await window.electronAPI.createFile(dirPath, fileName)
      if (response && response.success && response.data) {
        await refreshTree()
        return response.data
      }
      return null
    } catch (e) {
      error.value = `Failed to create file: ${e}`
      return null
    }
  }

  async function createDirectory(dirPath: string, dirName: string) {
    if (!window.electronAPI) return null

    try {
      const response = await window.electronAPI.createDirectory(dirPath, dirName)
      if (response && response.success && response.data) {
        await refreshTree()
        return response.data
      }
      return null
    } catch (e) {
      error.value = `Failed to create directory: ${e}`
      return null
    }
  }

  async function deleteFile(filePath: string) {
    if (!window.electronAPI) return false

    try {
      const response = await window.electronAPI.deleteFile(filePath)
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
    if (!window.electronAPI) return null

    try {
      const response = await window.electronAPI.renameFile(oldPath, newName)
      if (response && response.success && response.data) {
        await refreshTree()
        return response.data
      }
      return null
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
    if (!window.electronAPI) {
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
      
      return { path: folderPath, tree }
    } catch (e) {
      error.value = `Failed to open folder: ${e}`
      console.error('[FileExplorerStore] Error in openFolderByPath:', e)
      return null
    }
  }

  function toggleFolder(node: FileTreeNodeType) {
    node.expanded = !node.expanded
    if (node.expanded && node.type === FILE_TYPES.DIRECTORY && (!node.children || node.children.length === 0)) {
      loadChildren(node)
    }
  }

  async function loadChildren(node: FileTreeNodeType) {
    if (node.type !== FILE_TYPES.DIRECTORY) return

    const children = await readDirectory(node.path)
    node.children = children
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
