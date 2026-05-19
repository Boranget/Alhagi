import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RecentFile, RecentFolder } from '@/types'
import { errorManager, ErrorCode, ErrorSeverity } from '@/services/errorHandler'
import { UI, EDITOR, AUTO_SAVE, I18N, IMAGE, LAUNCH } from '@/constants'

export interface Preferences {
  launchMode: 'last-session' | 'welcome' | 'empty' | 'folder'
  launchFolderPath?: string
  autoSave: boolean
  autoSaveInterval: number
  theme: 'light' | 'dark' | 'system' | string
  showSidebar: boolean
  showTabBar: boolean
  showStatusBar: boolean
  hideScrollBars: boolean
  isStickyNoteMode: boolean
  isImmersiveMode: boolean
  typewriterMode: boolean
  focusMode: boolean
  fontSize: number
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
  hideScrollBars: false,
  isStickyNoteMode: false,
  isImmersiveMode: false,
  typewriterMode: false,
  focusMode: false,
  fontSize: EDITOR.DEFAULT_FONT_SIZE,
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
  lastSession: undefined
}

const STORAGE_KEY = 'alhagi-preferences'

export const usePreferencesStore = defineStore('preferences', () => {
  // Individual refs for each preference
  const launchMode = ref<Preferences['launchMode']>(DEFAULT_PREFERENCES.launchMode)
  const launchFolderPath = ref<string | undefined>(DEFAULT_PREFERENCES.launchFolderPath)
  const autoSave = ref<boolean>(DEFAULT_PREFERENCES.autoSave)
  const autoSaveInterval = ref<number>(DEFAULT_PREFERENCES.autoSaveInterval)
  const theme = ref<Preferences['theme']>(DEFAULT_PREFERENCES.theme)
  const showSidebar = ref<boolean>(DEFAULT_PREFERENCES.showSidebar)
  const showTabBar = ref<boolean>(DEFAULT_PREFERENCES.showTabBar)
  const showStatusBar = ref<boolean>(DEFAULT_PREFERENCES.showStatusBar)
  const hideScrollBars = ref<boolean>(DEFAULT_PREFERENCES.hideScrollBars)
  const isStickyNoteMode = ref<boolean>(DEFAULT_PREFERENCES.isStickyNoteMode)
  const isImmersiveMode = ref<boolean>(DEFAULT_PREFERENCES.isImmersiveMode)
  const typewriterMode = ref<boolean>(DEFAULT_PREFERENCES.typewriterMode)
  const focusMode = ref<boolean>(DEFAULT_PREFERENCES.focusMode)
  const fontSize = ref<number>(DEFAULT_PREFERENCES.fontSize)
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
  const lastSession = ref<Preferences['lastSession']>(DEFAULT_PREFERENCES.lastSession)

  // Helper to get all preferences
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
      hideScrollBars: hideScrollBars.value,
      isStickyNoteMode: isStickyNoteMode.value,
      isImmersiveMode: isImmersiveMode.value,
      typewriterMode: typewriterMode.value,
      focusMode: focusMode.value,
      fontSize: fontSize.value,
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
      lastSession: lastSession.value
    }
  }

  // Helper to set a single preference
  function setPreference<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ): void {
    switch (key) {
      case 'launchMode': launchMode.value = value as Preferences['launchMode']; break
      case 'launchFolderPath': launchFolderPath.value = value as string; break
      case 'autoSave': autoSave.value = value as boolean; break
      case 'autoSaveInterval': autoSaveInterval.value = value as number; break
      case 'theme': theme.value = value as Preferences['theme']; break
      case 'showSidebar': showSidebar.value = value as boolean; break
      case 'showTabBar': showTabBar.value = value as boolean; break
      case 'showStatusBar': showStatusBar.value = value as boolean; break
      case 'hideScrollBars': hideScrollBars.value = value as boolean; break
      case 'isStickyNoteMode': isStickyNoteMode.value = value as boolean; break
      case 'isImmersiveMode': isImmersiveMode.value = value as boolean; break
      case 'typewriterMode': typewriterMode.value = value as boolean; break
      case 'focusMode': focusMode.value = value as boolean; break
      case 'fontSize': fontSize.value = value as number; break
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
      case 'lastSession': lastSession.value = value as Preferences['lastSession']; break
    }
    savePreferences()
  }

  // Helper to update multiple preferences
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

  function applyTheme(): void {
    const effectiveTheme = theme.value === UI.THEMES.SYSTEM
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? UI.THEMES.DARK
          : UI.THEMES.LIGHT)
      : theme.value

    document.documentElement.setAttribute('data-theme', effectiveTheme)
    
    // 添加 dark 类以支持 Tailwind CSS 和其他基于类的样式
    document.documentElement.classList.toggle('dark', effectiveTheme === UI.THEMES.DARK)
    
    // 订阅系统主题变化（仅当主题设置为 SYSTEM 时）
    if (theme.value === UI.THEMES.SYSTEM) {
      subscribeToSystemTheme()
    } else {
      unsubscribeFromSystemTheme()
    }
  }

  let systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null

  function subscribeToSystemTheme(): void {
    unsubscribeFromSystemTheme()
    
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    systemThemeListener = (event: MediaQueryListEvent) => {
      if (theme.value === UI.THEMES.SYSTEM) {
        const newTheme = event.matches ? UI.THEMES.DARK : UI.THEMES.LIGHT
        document.documentElement.setAttribute('data-theme', newTheme)
        document.documentElement.classList.toggle('dark', newTheme === UI.THEMES.DARK)
      }
    }
    
    media.addEventListener('change', systemThemeListener)
  }

  function unsubscribeFromSystemTheme(): void {
    if (systemThemeListener) {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      media.removeEventListener('change', systemThemeListener)
      systemThemeListener = null
    }
  }

  function toggleTheme(): void {
    const themes: Array<Preferences['theme']> = [
      UI.THEMES.LIGHT,
      UI.THEMES.DARK,
      UI.THEMES.SYSTEM
    ]
    const currentIndex = themes.indexOf(theme.value)
    const nextIndex = (currentIndex + 1) % themes.length
    theme.value = themes[nextIndex]
    applyTheme()
    savePreferences()
  }

  function addRecentFile(filePath: string, title: string): void {
    const existingIndex = recentFiles.value.findIndex(f => f.filePath === filePath)

    if (existingIndex !== -1) {
      recentFiles.value[existingIndex].lastOpened = Date.now()
      const [existing] = recentFiles.value.splice(existingIndex, 1)
      recentFiles.value.unshift(existing)
    } else {
      recentFiles.value.unshift({
        filePath,
        title,
        lastOpened: Date.now(),
        pinned: false
      })

      if (recentFiles.value.length > maxRecentFiles.value) {
        const pinnedFiles = recentFiles.value.filter(f => f.pinned)
        const unpinnedFiles = recentFiles.value.filter(f => !f.pinned)
        while (pinnedFiles.length + unpinnedFiles.length > maxRecentFiles.value && unpinnedFiles.length > 0) {
          unpinnedFiles.pop()
        }
        recentFiles.value = [...pinnedFiles, ...unpinnedFiles]
      }
    }

    savePreferences()
  }

  function removeRecentFile(filePath: string): void {
    const index = recentFiles.value.findIndex(f => f.filePath === filePath)
    if (index !== -1) {
      recentFiles.value.splice(index, 1)
      savePreferences()
    }
  }

  function pinRecentFile(filePath: string, pinned: boolean): void {
    const file = recentFiles.value.find(f => f.filePath === filePath)
    if (file) {
      file.pinned = pinned
      if (pinned) {
        const index = recentFiles.value.indexOf(file)
        recentFiles.value.splice(index, 1)
        const pinnedFiles = recentFiles.value.filter(f => f.pinned)
        const unpinnedFiles = recentFiles.value.filter(f => !f.pinned)
        recentFiles.value = [file, ...pinnedFiles, ...unpinnedFiles]
      }
      savePreferences()
    }
  }

  function clearRecentFiles(): void {
    recentFiles.value = recentFiles.value.filter(f => f.pinned)
    savePreferences()
  }

  function addRecentFolder(folderPath: string, name: string): void {
    const existingIndex = recentFolders.value.findIndex(f => f.folderPath === folderPath)

    if (existingIndex !== -1) {
      recentFolders.value[existingIndex].lastOpened = Date.now()
      const [existing] = recentFolders.value.splice(existingIndex, 1)
      recentFolders.value.unshift(existing)
    } else {
      recentFolders.value.unshift({
        folderPath,
        name,
        lastOpened: Date.now(),
        pinned: false
      })

      if (recentFolders.value.length > maxRecentFolders.value) {
        const pinnedFolders = recentFolders.value.filter(f => f.pinned)
        const unpinnedFolders = recentFolders.value.filter(f => !f.pinned)
        while (pinnedFolders.length + unpinnedFolders.length > maxRecentFolders.value && unpinnedFolders.length > 0) {
          unpinnedFolders.pop()
        }
        recentFolders.value = [...pinnedFolders, ...unpinnedFolders]
      }
    }

    savePreferences()
  }

  function removeRecentFolder(folderPath: string): void {
    const index = recentFolders.value.findIndex(f => f.folderPath === folderPath)
    if (index !== -1) {
      recentFolders.value.splice(index, 1)
      savePreferences()
    }
  }

  function pinRecentFolder(folderPath: string, pinned: boolean): void {
    const folder = recentFolders.value.find(f => f.folderPath === folderPath)
    if (folder) {
      folder.pinned = pinned
      if (pinned) {
        const index = recentFolders.value.indexOf(folder)
        recentFolders.value.splice(index, 1)
        const pinnedFolders = recentFolders.value.filter(f => f.pinned)
        const unpinnedFolders = recentFolders.value.filter(f => !f.pinned)
        recentFolders.value = [folder, ...pinnedFolders, ...unpinnedFolders]
      }
      savePreferences()
    }
  }

  function clearRecentFolders(): void {
    recentFolders.value = recentFolders.value.filter(f => f.pinned)
    savePreferences()
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
      console.error('Failed to load custom themes:', error)
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

  function toggleStickyNoteMode(): void {
    isStickyNoteMode.value = !isStickyNoteMode.value
    if (isStickyNoteMode.value) {
      showSidebar.value = false
      showTabBar.value = false
      showStatusBar.value = false
    } else {
      showSidebar.value = DEFAULT_PREFERENCES.showSidebar
      showTabBar.value = DEFAULT_PREFERENCES.showTabBar
      showStatusBar.value = DEFAULT_PREFERENCES.showStatusBar
    }
    savePreferences()
  }

  function toggleImmersiveMode(): void {
    isImmersiveMode.value = !isImmersiveMode.value
    if (isImmersiveMode.value) {
      showSidebar.value = false
      showTabBar.value = false
      showStatusBar.value = false
    } else {
      showSidebar.value = DEFAULT_PREFERENCES.showSidebar
      showTabBar.value = DEFAULT_PREFERENCES.showTabBar
      showStatusBar.value = DEFAULT_PREFERENCES.showStatusBar
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
    console.log('[PreferencesStore] 开始加载偏好设置')
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        console.log('[PreferencesStore] 找到保存的设置:', saved.substring(0, 200))
        const preferences = JSON.parse(saved) as Partial<Preferences>
        updatePreferences(preferences)
        applyTheme()
      } else {
        console.log('[PreferencesStore] 未找到保存的设置，使用默认值')
        applyTheme()
      }
    } catch (error) {
      console.error('[PreferencesStore] 加载偏好设置失败:', error)
      applyTheme()
    }
  }

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
    hideScrollBars,
    isStickyNoteMode,
    isImmersiveMode,
    typewriterMode,
    focusMode,
    fontSize,
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
    lastSession,

    // Methods
    getAllPreferences,
    setPreference,
    updatePreferences,
    resetToDefaults,
    applyTheme,
    toggleTheme,
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
    savePreferences,
    loadPreferences,
    saveSession,
    getLastSession,
    clearSession
  }
})
