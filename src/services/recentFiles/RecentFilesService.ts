import { usePreferencesStore } from '@/stores/preferences'

export function useRecentFilesService() {
  const preferences = usePreferencesStore()

  function addRecentFile(filePath: string, title: string): void {
    const existingIndex = preferences.recentFiles.findIndex(f => f.filePath === filePath)

    if (existingIndex !== -1) {
      preferences.recentFiles[existingIndex].lastOpened = Date.now()
      const [existing] = preferences.recentFiles.splice(existingIndex, 1)
      preferences.recentFiles.unshift(existing)
    } else {
      preferences.recentFiles.unshift({
        filePath,
        title,
        lastOpened: Date.now(),
        pinned: false
      })

      if (preferences.recentFiles.length > preferences.maxRecentFiles) {
        const pinnedFiles = preferences.recentFiles.filter(f => f.pinned)
        const unpinnedFiles = preferences.recentFiles.filter(f => !f.pinned)
        while (pinnedFiles.length + unpinnedFiles.length > preferences.maxRecentFiles && unpinnedFiles.length > 0) {
          unpinnedFiles.pop()
        }
        preferences.recentFiles = [...pinnedFiles, ...unpinnedFiles]
      }
    }

    preferences.savePreferences()
  }

  function removeRecentFile(filePath: string): void {
    const index = preferences.recentFiles.findIndex(f => f.filePath === filePath)
    if (index !== -1) {
      preferences.recentFiles.splice(index, 1)
      preferences.savePreferences()
    }
  }

  function pinRecentFile(filePath: string, pinned: boolean): void {
    const file = preferences.recentFiles.find(f => f.filePath === filePath)
    if (file) {
      file.pinned = pinned
      if (pinned) {
        const index = preferences.recentFiles.indexOf(file)
        preferences.recentFiles.splice(index, 1)
        const pinnedFiles = preferences.recentFiles.filter(f => f.pinned)
        const unpinnedFiles = preferences.recentFiles.filter(f => !f.pinned)
        preferences.recentFiles = [file, ...pinnedFiles, ...unpinnedFiles]
      }
      preferences.savePreferences()
    }
  }

  function clearRecentFiles(): void {
    preferences.recentFiles = preferences.recentFiles.filter(f => f.pinned)
    preferences.savePreferences()
  }

  function addRecentFolder(folderPath: string, name: string): void {
    const existingIndex = preferences.recentFolders.findIndex(f => f.folderPath === folderPath)

    if (existingIndex !== -1) {
      preferences.recentFolders[existingIndex].lastOpened = Date.now()
      const [existing] = preferences.recentFolders.splice(existingIndex, 1)
      preferences.recentFolders.unshift(existing)
    } else {
      preferences.recentFolders.unshift({
        folderPath,
        name,
        lastOpened: Date.now(),
        pinned: false
      })

      if (preferences.recentFolders.length > preferences.maxRecentFolders) {
        const pinnedFolders = preferences.recentFolders.filter(f => f.pinned)
        const unpinnedFolders = preferences.recentFolders.filter(f => !f.pinned)
        while (pinnedFolders.length + unpinnedFolders.length > preferences.maxRecentFolders && unpinnedFolders.length > 0) {
          unpinnedFolders.pop()
        }
        preferences.recentFolders = [...pinnedFolders, ...unpinnedFolders]
      }
    }

    preferences.savePreferences()
  }

  function removeRecentFolder(folderPath: string): void {
    const index = preferences.recentFolders.findIndex(f => f.folderPath === folderPath)
    if (index !== -1) {
      preferences.recentFolders.splice(index, 1)
      preferences.savePreferences()
    }
  }

  function pinRecentFolder(folderPath: string, pinned: boolean): void {
    const folder = preferences.recentFolders.find(f => f.folderPath === folderPath)
    if (folder) {
      folder.pinned = pinned
      if (pinned) {
        const index = preferences.recentFolders.indexOf(folder)
        preferences.recentFolders.splice(index, 1)
        const pinnedFolders = preferences.recentFolders.filter(f => f.pinned)
        const unpinnedFolders = preferences.recentFolders.filter(f => !f.pinned)
        preferences.recentFolders = [folder, ...pinnedFolders, ...unpinnedFolders]
      }
      preferences.savePreferences()
    }
  }

  function clearRecentFolders(): void {
    preferences.recentFolders = preferences.recentFolders.filter(f => f.pinned)
    preferences.savePreferences()
  }

  return {
    addRecentFile,
    removeRecentFile,
    pinRecentFile,
    clearRecentFiles,
    addRecentFolder,
    removeRecentFolder,
    pinRecentFolder,
    clearRecentFolders
  }
}
