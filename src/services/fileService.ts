import { ref } from 'vue'
import type { FileTreeNode, DirectoryEntry } from '@/types'

export function useFileService() {
  const currentFolder = ref<string | null>(null)
  const fileTree = ref<FileTreeNode[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function openFolder() {
    if (!window.electronAPI) {
      error.value = 'Electron API not available'
      return null
    }

    try {
      const result = await window.electronAPI.openFolder()
      if (result) {
        currentFolder.value = result.path
        fileTree.value = result.tree
        return result
      }
      return null
    } catch (e) {
      error.value = `Failed to open folder: ${e}`
      return null
    }
  }

  async function readDirectory(dirPath: string): Promise<FileTreeNode[]> {
    if (!window.electronAPI) return []

    try {
      const entries = await window.electronAPI.readDirectory(dirPath)
      return entries.map((entry: DirectoryEntry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.isDirectory ? 'directory' : 'file' as const,
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
      const result = await window.electronAPI.readFile(filePath)
      return result
    } catch (e) {
      error.value = `Failed to open file: ${e}`
      return null
    }
  }

  async function saveFile(filePath: string, content: string) {
    if (!window.electronAPI) return false

    try {
      await window.electronAPI.saveFile(filePath, content)
      return true
    } catch (e) {
      error.value = `Failed to save file: ${e}`
      return false
    }
  }

  async function createFile(dirPath: string, fileName: string) {
    if (!window.electronAPI) return null

    try {
      const filePath = await window.electronAPI.createFile(dirPath, fileName)
      if (filePath) {
        await refreshTree()
      }
      return filePath
    } catch (e) {
      error.value = `Failed to create file: ${e}`
      return null
    }
  }

  async function createDirectory(dirPath: string, dirName: string) {
    if (!window.electronAPI) return null

    try {
      const newDirPath = await window.electronAPI.createDirectory(dirPath, dirName)
      if (newDirPath) {
        await refreshTree()
      }
      return newDirPath
    } catch (e) {
      error.value = `Failed to create directory: ${e}`
      return null
    }
  }

  async function deleteFile(filePath: string) {
    if (!window.electronAPI) return false

    try {
      await window.electronAPI.deleteFile(filePath)
      await refreshTree()
      return true
    } catch (e) {
      error.value = `Failed to delete file: ${e}`
      return false
    }
  }

  async function renameFile(oldPath: string, newName: string) {
    if (!window.electronAPI) return null

    try {
      const newPath = await window.electronAPI.renameFile(oldPath, newName)
      if (newPath) {
        await refreshTree()
      }
      return newPath
    } catch (e) {
      error.value = `Failed to rename file: ${e}`
      return null
    }
  }

  async function refreshTree() {
    if (!currentFolder.value) return

    isLoading.value = true
    try {
      const tree = await readDirectory(currentFolder.value)
      fileTree.value = tree
    } finally {
      isLoading.value = false
    }
  }

  function toggleFolder(node: FileTreeNode) {
    node.expanded = !node.expanded
    if (node.expanded && node.type === 'directory' && (!node.children || node.children.length === 0)) {
      loadChildren(node)
    }
  }

  async function loadChildren(node: FileTreeNode) {
    if (node.type !== 'directory') return

    const children = await readDirectory(node.path)
    node.children = children
  }

  return {
    currentFolder,
    fileTree,
    isLoading,
    error,
    openFolder,
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
}
