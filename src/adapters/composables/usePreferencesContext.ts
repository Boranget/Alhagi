import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@/stores/preferences'

export function usePreferencesContext() {
  const store = usePreferencesStore()
  const {
    theme, fontSize, lineHeight, sourceFontSize, sourceLineHeight,
    zoom, wordWrap, wordCountDisplayType,
    imageInsertMode, imageCopyPath, imagePreferRelativePath, imageApplyToLocal, imageApplyToRemote, imageEscapeUrl,
    language, devToolsOnStartup, lineEnding,
    openFileInNewWindow, openFolderInNewWindow,
    recentFiles, maxRecentFiles, recentFolders, maxRecentFolders,
    customThemePath, customThemes, lastSession,
    hideScrollBars, autoSave, autoSaveInterval, launchMode,
  } = storeToRefs(store)

  return {
    theme, fontSize, lineHeight, sourceFontSize, sourceLineHeight,
    zoom, wordWrap, wordCountDisplayType,
    imageInsertMode, imageCopyPath, imagePreferRelativePath, imageApplyToLocal, imageApplyToRemote, imageEscapeUrl,
    language, devToolsOnStartup, lineEnding,
    openFileInNewWindow, openFolderInNewWindow,
    recentFiles, maxRecentFiles, recentFolders, maxRecentFolders,
    customThemePath, customThemes, lastSession,
    hideScrollBars, autoSave, autoSaveInterval, launchMode,
    setOne: store.setOne,
    setMany: store.setMany,
    resetToDefaults: store.resetToDefaults,
    applyTheme: store.applyTheme,
    toggleLightDark: store.toggleLightDark,
    addRecentFile: store.addRecentFile,
    removeRecentFile: store.removeRecentFile,
    pinRecentFile: store.pinRecentFile,
    clearRecentFiles: store.clearRecentFiles,
    addRecentFolder: store.addRecentFolder,
    removeRecentFolder: store.removeRecentFolder,
    pinRecentFolder: store.pinRecentFolder,
    clearRecentFolders: store.clearRecentFolders,
    loadCustomThemes: store.loadCustomThemes,
    applyCustomTheme: store.applyCustomTheme,
    resetToBuiltInTheme: store.resetToBuiltInTheme,
    toggleWordCountDisplayType: store.toggleWordCountDisplayType,
    zoomIn: store.zoomIn,
    zoomOut: store.zoomOut,
    resetZoom: store.resetZoom,
    saveSession: store.saveSession,
    getLastSession: store.getLastSession,
    clearSession: store.clearSession,
  }
}

export type PreferencesContext = ReturnType<typeof usePreferencesContext>
