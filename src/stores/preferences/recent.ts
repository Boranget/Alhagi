import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RecentFile, RecentFolder } from '@/types'
import { useRecentFilesService } from '@/services/recentFiles/RecentFilesService'

export const useRecentPreferencesStore = defineStore('preferences-recent', () => {
  const recentFiles = ref<RecentFile[]>([])
  const maxRecentFiles = ref<number>(20)
  const recentFolders = ref<RecentFolder[]>([])
  const maxRecentFolders = ref<number>(10)

  // RecentFilesService 懒实例化（避免 store 内循环）
  let recentFilesService: ReturnType<typeof useRecentFilesService> | null = null
  function rfs() {
    if (!recentFilesService) recentFilesService = useRecentFilesService()
    return recentFilesService
  }

  function applyPatch(patch: Partial<{
    recentFiles: RecentFile[]
    maxRecentFiles: number
    recentFolders: RecentFolder[]
    maxRecentFolders: number
  }>): void {
    if (patch.recentFiles !== undefined) recentFiles.value = patch.recentFiles
    if (patch.maxRecentFiles !== undefined) maxRecentFiles.value = patch.maxRecentFiles
    if (patch.recentFolders !== undefined) recentFolders.value = patch.recentFolders
    if (patch.maxRecentFolders !== undefined) maxRecentFolders.value = patch.maxRecentFolders
  }

  function addRecentFile(filePath: string, title: string): void {
    rfs().addRecentFile(filePath, title)
  }

  function removeRecentFile(filePath: string): void {
    rfs().removeRecentFile(filePath)
  }

  function pinRecentFile(filePath: string, pinned: boolean): void {
    rfs().pinRecentFile(filePath, pinned)
  }

  function clearRecentFiles(): void {
    rfs().clearRecentFiles()
  }

  function addRecentFolder(folderPath: string, name: string): void {
    rfs().addRecentFolder(folderPath, name)
  }

  function removeRecentFolder(folderPath: string): void {
    rfs().removeRecentFolder(folderPath)
  }

  function pinRecentFolder(folderPath: string, pinned: boolean): void {
    rfs().pinRecentFolder(folderPath, pinned)
  }

  function clearRecentFolders(): void {
    rfs().clearRecentFolders()
  }

  return {
    recentFiles,
    maxRecentFiles,
    recentFolders,
    maxRecentFolders,
    applyPatch,
    addRecentFile,
    removeRecentFile,
    pinRecentFile,
    clearRecentFiles,
    addRecentFolder,
    removeRecentFolder,
    pinRecentFolder,
    clearRecentFolders,
  }
})
