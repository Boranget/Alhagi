import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { RecentFile, RecentFolder } from '@/types'
import { errorManager, ErrorCode, ErrorSeverity } from '@/services/errorHandler'
import { UI, EDITOR, AUTO_SAVE, I18N, IMAGE, LAUNCH } from '@/constants'
import { useThemeService } from '@/services/theme/ThemeService'
import { useRecentFilesService } from '@/services/recentFiles/RecentFilesService'
import { setLanguage as setI18nLanguage } from '@/services/i18n'

export interface Preferences {
  launchMode: 'last-session' | 'welcome' | 'empty' | 'folder'
  launchFolderPath?: string
  autoSave: boolean
  autoSaveInterval: number
  theme: 'light' | 'dark' | 'system' | string
  showSidebar: boolean
  showTabBar: boolean
  showStatusBar: boolean
  showMenuBar: boolean
  hideScrollBars: boolean
  isStickyNoteMode: boolean
  isImmersiveMode: boolean
  typewriterMode: boolean
  focusMode: boolean
  fontSize: number
  zoom: number
  wordWrap: boolean
  imageInsertMode: 'keep-original' | 'copy-absolute' | 'copy-relative'
  imageStoragePath: string
  language: 'zh-CN' | 'en'
  devToolsOnStartup: boolean
  openFileInNewWindow: boolean
  openFolderInNewWindow: boolean
  lineEnding: 'lf' | 'crlf'
  recentFiles: RecentFile[]
  maxRecentFiles: number
  recentFolders: RecentFolder[]
  maxRecentFolders: number
  customThemePath: string
  customThemes: CustomTheme[]
  wordCountDisplayType: 'raw' | 'rendered'
  lastSession?: {
    tabs: Array<{
      title: string
      content: string
      filePath: string | null
      viewMode: string
      isDirty: boolean
      cursor: { from: number; to: number }
    }>
    activeTabId?: string
    currentFolder?: string
  }
}

export interface CustomTheme {
  id: string
  name: string
  path: string
  colors: ThemeColors
}

export interface ThemeColors {
  '--bg-primary': string
  '--bg-secondary': string
  '--text-primary': string
  '--text-secondary': string
  '--border-color': string
  '--primary-color': string
  '--sidebar-bg': string
  '--sidebar-hover-bg': string
  '--input-bg': string
}

const DEFAULT_PREFERENCES: Preferences = {
  launchMode: LAUNCH.MODES.WELCOME,
  launchFolderPath: '',
  autoSave: true,
  autoSaveInterval: AUTO_SAVE.DEFAULT_INTERVAL,
  theme: UI.THEMES.LIGHT,
  showSidebar: true,
  showTabBar: true,
  showStatusBar: true,
  showMenuBar: true,
  hideScrollBars: false,
  isStickyNoteMode: false,
  isImmersiveMode: false,
  typewriterMode: false,
  focusMode: false,
  fontSize: EDITOR.DEFAULT_FONT_SIZE,
  zoom: 100,
  wordWrap: true,
  imageInsertMode: IMAGE.INSERT_MODES.KEEP_ORIGINAL,
  imageStoragePath: '',
  language: I18N.DEFAULT_LANGUAGE,
  devToolsOnStartup: false,
  openFileInNewWindow: false,
  openFolderInNewWindow: false,
  lineEnding: 'lf' as const,
  recentFiles: [],
  maxRecentFiles: 20,
  recentFolders: [],
  maxRecentFolders: 10,
  customThemePath: '',
  customThemes: [],
  wordCountDisplayType: 'raw',
  lastSession: undefined
}

const STORAGE_KEY = 'alhagi-preferences'

export const usePreferencesStore = defineStore('preferences', () => {
  const launchMode = ref<Preferences['launchMode']>(DEFAULT_PREFERENCES.launchMode)
  const launchFolderPath = ref<string | undefined>(DEFAULT_PREFERENCES.launchFolderPath)
  const autoSave = ref<boolean>(DEFAULT_PREFERENCES.autoSave)
  const autoSaveInterval = ref<number>(DEFAULT_PREFERENCES.autoSaveInterval)
  const theme = ref<Preferences['theme']>(DEFAULT_PREFERENCES.theme)
  const showSidebar = ref<boolean>(DEFAULT_PREFERENCES.showSidebar)
  const showTabBar = ref<boolean>(DEFAULT_PREFERENCES.showTabBar)
  const showStatusBar = ref<boolean>(DEFAULT_PREFERENCES.showStatusBar)
  const showMenuBar = ref<boolean>(DEFAULT_PREFERENCES.showMenuBar)
  const hideScrollBars = ref<boolean>(DEFAULT_PREFERENCES.hideScrollBars)
  const isStickyNoteMode = ref<boolean>(DEFAULT_PREFERENCES.isStickyNoteMode)
  const isImmersiveMode = ref<boolean>(DEFAULT_PREFERENCES.isImmersiveMode)
  const typewriterMode = ref<boolean>(DEFAULT_PREFERENCES.typewriterMode)
  const focusMode = ref<boolean>(DEFAULT_PREFERENCES.focusMode)
  const fontSize = ref<number>(DEFAULT_PREFERENCES.fontSize)
  const zoom = ref<number>(DEFAULT_PREFERENCES.zoom)
  const wordWrap = ref<boolean>(DEFAULT_PREFERENCES.wordWrap)
  const imageInsertMode = ref<Preferences['imageInsertMode']>(DEFAULT_PREFERENCES.imageInsertMode)
  const imageStoragePath = ref<string>(DEFAULT_PREFERENCES.imageStoragePath)
  const language = ref<Preferences['language']>(DEFAULT_PREFERENCES.language)
  const devToolsOnStartup = ref<boolean>(DEFAULT_PREFERENCES.devToolsOnStartup)
  const openFileInNewWindow = ref<boolean>(DEFAULT_PREFERENCES.openFileInNewWindow)
  const openFolderInNewWindow = ref<boolean>(DEFAULT_PREFERENCES.openFolderInNewWindow)
  const lineEnding = ref<Preferences['lineEnding']>(DEFAULT_PREFERENCES.lineEnding)
  const recentFiles = ref<RecentFile[]>(DEFAULT_PREFERENCES.recentFiles)
  const maxRecentFiles = ref<number>(DEFAULT_PREFERENCES.maxRecentFiles)
  const recentFolders = ref<RecentFolder[]>(DEFAULT_PREFERENCES.recentFolders)
  const maxRecentFolders = ref<number>(DEFAULT_PREFERENCES.maxRecentFolders)
  const customThemePath = ref<string>(DEFAULT_PREFERENCES.customThemePath)
  const customThemes = ref<CustomTheme[]>(DEFAULT_PREFERENCES.customThemes)
  const wordCountDisplayType = ref<Preferences['wordCountDisplayType']>(DEFAULT_PREFERENCES.wordCountDisplayType)
  const lastSession = ref<Preferences['lastSession']>(DEFAULT_PREFERENCES.lastSession)

  // 语言变更时同步到 i18n 服务，让所有调用 t() 的组件自动重渲染
  watch(language, (lang) => {
    setI18nLanguage(lang)
  }, { immediate: true })

  const { applyTheme, toggleLightDark } = useThemeService()
  const {
    addRecentFile,
    removeRecentFile,
    pinRecentFile,
    clearRecentFiles,
    addRecentFolder,
    removeRecentFolder,
    pinRecentFolder,
    clearRecentFolders
  } = useRecentFilesService()

  function getAllPreferences(): Preferences {
    return {
      launchMode: launchMode.value,
      launchFolderPath: launchFolderPath.value,
      autoSave: autoSave.value,
      autoSaveInterval: autoSaveInterval.value,
      theme: theme.value,
      showSidebar: showSidebar.value,
      showTabBar: showTabBar.value,
      showStatusBar: showStatusBar.value,
      showMenuBar: showMenuBar.value,
      hideScrollBars: hideScrollBars.value,
      isStickyNoteMode: isStickyNoteMode.value,
      isImmersiveMode: isImmersiveMode.value,
      typewriterMode: typewriterMode.value,
      focusMode: focusMode.value,
      fontSize: fontSize.value,
      zoom: zoom.value,
      wordWrap: wordWrap.value,
      imageInsertMode: imageInsertMode.value,
      imageStoragePath: imageStoragePath.value,
      language: language.value,
      devToolsOnStartup: devToolsOnStartup.value,
      openFileInNewWindow: openFileInNewWindow.value,
      openFolderInNewWindow: openFolderInNewWindow.value,
      lineEnding: lineEnding.value,
      recentFiles: recentFiles.value,
      maxRecentFiles: maxRecentFiles.value,
      recentFolders: recentFolders.value,
      maxRecentFolders: maxRecentFolders.value,
      customThemePath: customThemePath.value,
      customThemes: customThemes.value,
      wordCountDisplayType: wordCountDisplayType.value,
      lastSession: lastSession.value
    }
  }

  function setPreference<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ): void {
    switch (key) {
      case 'launchMode': launchMode.value = value as Preferences['launchMode']; break
      case 'launchFolderPath': launchFolderPath.value = value as string; break
      case 'autoSave': autoSave.value = value as boolean; break
      case 'autoSaveInterval': autoSaveInterval.value = value as number; break
      case 'theme':
        theme.value = value as Preferences['theme']
        applyTheme()
        break
      case 'showSidebar': showSidebar.value = value as boolean; break
      case 'showTabBar': showTabBar.value = value as boolean; break
      case 'showStatusBar': showStatusBar.value = value as boolean; break
      case 'showMenuBar': showMenuBar.value = value as boolean; break
      case 'hideScrollBars': hideScrollBars.value = value as boolean; break
      case 'isStickyNoteMode': isStickyNoteMode.value = value as boolean; break
      case 'isImmersiveMode': isImmersiveMode.value = value as boolean; break
      case 'typewriterMode': typewriterMode.value = value as boolean; break
      case 'focusMode': focusMode.value = value as boolean; break
      case 'fontSize': fontSize.value = value as number; break
      case 'zoom': zoom.value = value as number; break
      case 'wordWrap': wordWrap.value = value as boolean; break
      case 'imageInsertMode': imageInsertMode.value = value as Preferences['imageInsertMode']; break
      case 'imageStoragePath': imageStoragePath.value = value as string; break
      case 'language': language.value = value as Preferences['language']; break
      case 'devToolsOnStartup': devToolsOnStartup.value = value as boolean; break
      case 'openFileInNewWindow': openFileInNewWindow.value = value as boolean; break
      case 'openFolderInNewWindow': openFolderInNewWindow.value = value as boolean; break
      case 'lineEnding': lineEnding.value = value as Preferences['lineEnding']; break
      case 'recentFiles': recentFiles.value = value as RecentFile[]; break
      case 'maxRecentFiles': maxRecentFiles.value = value as number; break
      case 'recentFolders': recentFolders.value = value as RecentFolder[]; break
      case 'maxRecentFolders': maxRecentFolders.value = value as number; break
      case 'customThemePath': customThemePath.value = value as string; break
      case 'customThemes': customThemes.value = value as CustomTheme[]; break
      case 'wordCountDisplayType': wordCountDisplayType.value = value as Preferences['wordCountDisplayType']; break
      case 'lastSession': lastSession.value = value as Preferences['lastSession']; break
    }
    savePreferences()
  }

  function updatePreferences(updates: Partial<Preferences>): void {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setPreference(key as keyof Preferences, value as Preferences[keyof Preferences])
      }
    }
  }

  function resetToDefaults(): void {
    updatePreferences(DEFAULT_PREFERENCES)
  }

  function toggleStickyNoteMode(): void {
    isStickyNoteMode.value = !isStickyNoteMode.value
    if (isStickyNoteMode.value) {
      showSidebar.value = false
      showTabBar.value = false
      showStatusBar.value = false
      showMenuBar.value = false
    } else {
      showSidebar.value = DEFAULT_PREFERENCES.showSidebar
      showTabBar.value = DEFAULT_PREFERENCES.showTabBar
      showStatusBar.value = DEFAULT_PREFERENCES.showStatusBar
      showMenuBar.value = DEFAULT_PREFERENCES.showMenuBar
    }
    savePreferences()
  }

  function toggleImmersiveMode(): void {
    isImmersiveMode.value = !isImmersiveMode.value
    if (isImmersiveMode.value) {
      showSidebar.value = false
      showTabBar.value = false
      showStatusBar.value = false
      showMenuBar.value = false
    } else {
      showSidebar.value = DEFAULT_PREFERENCES.showSidebar
      showTabBar.value = DEFAULT_PREFERENCES.showTabBar
      showStatusBar.value = DEFAULT_PREFERENCES.showStatusBar
      showMenuBar.value = DEFAULT_PREFERENCES.showMenuBar
    }
    savePreferences()
  }

  function saveSession(data: Preferences['lastSession']): void {
    lastSession.value = data
    savePreferences()
  }

  function getLastSession(): Preferences['lastSession'] {
    return lastSession.value
  }

  function clearSession(): void {
    lastSession.value = undefined
    savePreferences()
  }

  function toggleWordCountDisplayType(): void {
    wordCountDisplayType.value = wordCountDisplayType.value === 'raw' ? 'rendered' : 'raw'
    savePreferences()
  }

  function zoomIn(): void {
    const newZoom = Math.min(200, zoom.value + 10)
    console.log(`[PreferencesStore] zoomIn: ${zoom.value} -> ${newZoom}`)
    zoom.value = newZoom
    savePreferences()
  }

  function zoomOut(): void {
    const newZoom = Math.max(50, zoom.value - 10)
    console.log(`[PreferencesStore] zoomOut: ${zoom.value} -> ${newZoom}`)
    zoom.value = newZoom
    savePreferences()
  }

  function resetZoom(): void {
    console.log(`[PreferencesStore] resetZoom: ${zoom.value} -> ${DEFAULT_PREFERENCES.zoom}`)
    zoom.value = DEFAULT_PREFERENCES.zoom
    savePreferences()
  }

  function savePreferences(): void {
    try {
      const preferences = getAllPreferences()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch (error) {
      errorManager.createError(
        ErrorCode.FILE_WRITE_ERROR,
        '保存偏好设置失败',
        ErrorSeverity.ERROR,
        { context: 'preferences.savePreferences' }
      )
    }
  }

  function loadPreferences(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const preferences = JSON.parse(saved) as Partial<Preferences>
        updatePreferences(preferences)
        applyTheme()
      } else {
        applyTheme()
      }
    } catch (error) {
      applyTheme()
    }
  }

  async function loadCustomThemes(): Promise<void> {
    if (!customThemePath.value || !window.electronAPI) return

    try {
      const response = await window.electronAPI.readDirectory(customThemePath.value)
      if (response && response.success && response.data) {
        const themes: CustomTheme[] = []
        for (const entry of response.data) {
          if (entry.isFile && entry.name.endsWith('.json')) {
            const fileResponse = await window.electronAPI.readFile(entry.path)
            if (fileResponse && fileResponse.success && fileResponse.data) {
              try {
                const themeData = JSON.parse(fileResponse.data)
                if (themeData.name && themeData.colors) {
                  themes.push({
                    id: entry.path,
                    name: themeData.name,
                    path: entry.path,
                    colors: themeData.colors
                  })
                }
              } catch {
                // Skip invalid theme files
              }
            }
          }
        }
        customThemes.value = themes
        savePreferences()
      }
    } catch (error) {
      // Handle error silently
    }
  }

  function applyCustomTheme(themeId: string): void {
    const customTheme = customThemes.value.find(t => t.id === themeId)
    if (!customTheme) return

    Object.entries(customTheme.colors).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value as string)
    })

    theme.value = `custom-${themeId}` as 'light' | 'dark' | 'system'
    savePreferences()
  }

  function resetToBuiltInTheme(): void {
    applyTheme()
    theme.value = DEFAULT_PREFERENCES.theme
    savePreferences()
  }

  watch(
    () => ({
      launchMode: launchMode.value,
      launchFolderPath: launchFolderPath.value,
      autoSave: autoSave.value,
      autoSaveInterval: autoSaveInterval.value,
      theme: theme.value,
      showSidebar: showSidebar.value,
      showTabBar: showTabBar.value,
      showStatusBar: showStatusBar.value,
      hideScrollBars: hideScrollBars.value,
      isStickyNoteMode: isStickyNoteMode.value,
      isImmersiveMode: isImmersiveMode.value,
      typewriterMode: typewriterMode.value,
      focusMode: focusMode.value,
      fontSize: fontSize.value,
      zoom: zoom.value,
      wordWrap: wordWrap.value,
      imageInsertMode: imageInsertMode.value,
      imageStoragePath: imageStoragePath.value,
      language: language.value,
      devToolsOnStartup: devToolsOnStartup.value,
      openFileInNewWindow: openFileInNewWindow.value,
      openFolderInNewWindow: openFolderInNewWindow.value,
      lineEnding: lineEnding.value,
      wordCountDisplayType: wordCountDisplayType.value
    }),
    () => {
      savePreferences()
    },
    { deep: true }
  )

  watch(zoom, async (newZoom, oldZoom) => {
    console.log(`[PreferencesStore] zoom changed: ${oldZoom} -> ${newZoom}`)
    if (window.electronAPI) {
      console.log(`[PreferencesStore] Calling electronAPI.setZoom(${newZoom})`)
      const result = await window.electronAPI.setZoom(newZoom)
      console.log(`[PreferencesStore] setZoom result:`, result)
    } else {
      console.log('[PreferencesStore] electronAPI not available')
    }
  })

  return {
    // Getters
    launchMode,
    launchFolderPath,
    autoSave,
    autoSaveInterval,
    theme,
    showSidebar,
    showTabBar,
    showStatusBar,
    showMenuBar,
    hideScrollBars,
    isStickyNoteMode,
    isImmersiveMode,
    typewriterMode,
    focusMode,
    fontSize,
    zoom,
    wordWrap,
    imageInsertMode,
    imageStoragePath,
    language,
    devToolsOnStartup,
    openFileInNewWindow,
    openFolderInNewWindow,
    lineEnding,
    recentFiles,
    maxRecentFiles,
    recentFolders,
    maxRecentFolders,
    customThemePath,
    customThemes,
    wordCountDisplayType,
    lastSession,

    // Methods
    getAllPreferences,
    setPreference,
    updatePreferences,
    resetToDefaults,
    applyTheme,
    toggleLightDark,
    addRecentFile,
    removeRecentFile,
    pinRecentFile,
    clearRecentFiles,
    addRecentFolder,
    removeRecentFolder,
    pinRecentFolder,
    clearRecentFolders,
    loadCustomThemes,
    applyCustomTheme,
    resetToBuiltInTheme,
    toggleStickyNoteMode,
    toggleImmersiveMode,
    toggleWordCountDisplayType,
    zoomIn,
    zoomOut,
    resetZoom,
    savePreferences,
    loadPreferences,
    saveSession,
    getLastSession,
    clearSession
  }
})
