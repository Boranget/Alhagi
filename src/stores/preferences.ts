import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RecentFile, RecentFolder } from '@/types'
import { errorManager, ErrorCode, ErrorSeverity } from '@/services/errorHandler'
import { UI, EDITOR, AUTO_SAVE, I18N, IMAGE, LAUNCH } from '@/constants'

/**
 * Preferences Store
 * 管理应用程序的所有用户偏好设置
 * 使用统一的状态管理和持久化机制
 */

export interface Preferences {
  // 启动设置
  launchMode: 'last-session' | 'welcome' | 'empty' | 'folder'
  launchFolderPath?: string
  
  // 保存设置
  autoSave: boolean
  autoSaveInterval: number
  
  // 外观设置
  theme: 'light' | 'dark' | 'system' | string
  showSidebar: boolean
  showTabBar: boolean
  showStatusBar: boolean
  hideScrollBars: boolean
  
  // 特殊模式
  isStickyNoteMode: boolean
  isImmersiveMode: boolean
  
  // 编辑器设置
  typewriterMode: boolean
  focusMode: boolean
  fontSize: number
  wordWrap: boolean
  
  // 图片设置
  imageInsertMode: 'keep-original' | 'copy-absolute' | 'copy-relative'
  imageStoragePath: string
  
  // 语言设置
  language: 'zh-CN' | 'en'
  
  // 开发设置
  devToolsOnStartup: boolean
  
  // 文件打开行为
  openFileInNewWindow: boolean
  openFolderInNewWindow: boolean
  
  // 编辑器高级设置
  lineEnding: 'lf' | 'crlf'
  
  // 最近文件
  recentFiles: RecentFile[]
  maxRecentFiles: number
  
  // 最近文件夹
  recentFolders: RecentFolder[]
  maxRecentFolders: number
  
  // 自定义主题
  customThemePath: string
  customThemes: CustomTheme[]
  
  // 最后会话状态
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

/**
 * 默认偏好设置
 */
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

/**
 * Preferences Store
 * 提供类型安全的偏好设置管理
 */
export const usePreferencesStore = defineStore('preferences', () => {
  // 状态
  const launchMode = ref<Preferences['launchMode']>(DEFAULT_PREFERENCES.launchMode)
  const launchFolderPath = ref<string>(DEFAULT_PREFERENCES.launchFolderPath || '')
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
  const recentFiles = ref<RecentFile[]>(DEFAULT_PREFERENCES.recentFiles)
  const maxRecentFiles = ref<number>(DEFAULT_PREFERENCES.maxRecentFiles)
  const recentFolders = ref<RecentFolder[]>(DEFAULT_PREFERENCES.recentFolders)
  const maxRecentFolders = ref<number>(DEFAULT_PREFERENCES.maxRecentFolders)
  const customThemePath = ref<string>(DEFAULT_PREFERENCES.customThemePath)
  const customThemes = ref<CustomTheme[]>(DEFAULT_PREFERENCES.customThemes)
  const lineEnding = ref<Preferences['lineEnding']>(DEFAULT_PREFERENCES.lineEnding)
  const lastSession = ref<Preferences['lastSession']>(DEFAULT_PREFERENCES.lastSession)

  /**
   * 获取当前所有偏好设置
   */
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

  /**
   * 设置单个偏好项
   */
  function setPreference<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ): void {
    // 使用条件判断直接访问 ref
    if (key === 'launchMode') launchMode.value = value as Preferences['launchMode']
    else if (key === 'launchFolderPath') launchFolderPath.value = value as string
    else if (key === 'autoSave') autoSave.value = value as boolean
    else if (key === 'autoSaveInterval') autoSaveInterval.value = value as number
    else if (key === 'theme') theme.value = value as Preferences['theme']
    else if (key === 'showSidebar') showSidebar.value = value as boolean
    else if (key === 'showTabBar') showTabBar.value = value as boolean
    else if (key === 'showStatusBar') showStatusBar.value = value as boolean
    else if (key === 'hideScrollBars') hideScrollBars.value = value as boolean
    else if (key === 'isStickyNoteMode') isStickyNoteMode.value = value as boolean
    else if (key === 'isImmersiveMode') isImmersiveMode.value = value as boolean
    else if (key === 'typewriterMode') typewriterMode.value = value as boolean
    else if (key === 'focusMode') focusMode.value = value as boolean
    else if (key === 'fontSize') fontSize.value = value as number
    else if (key === 'wordWrap') wordWrap.value = value as boolean
    else if (key === 'imageInsertMode') imageInsertMode.value = value as Preferences['imageInsertMode']
    else if (key === 'imageStoragePath') imageStoragePath.value = value as string
    else if (key === 'language') language.value = value as Preferences['language']
    else if (key === 'devToolsOnStartup') devToolsOnStartup.value = value as boolean
    else if (key === 'openFileInNewWindow') openFileInNewWindow.value = value as boolean
    else if (key === 'openFolderInNewWindow') openFolderInNewWindow.value = value as boolean
    else if (key === 'recentFiles') recentFiles.value = value as RecentFile[]
    else if (key === 'maxRecentFiles') maxRecentFiles.value = value as number
    else if (key === 'recentFolders') recentFolders.value = value as RecentFolder[]
    else if (key === 'maxRecentFolders') maxRecentFolders.value = value as number
    else if (key === 'customThemePath') customThemePath.value = value as string
    else if (key === 'customThemes') customThemes.value = value as CustomTheme[]
    else if (key === 'lineEnding') lineEnding.value = value as Preferences['lineEnding']
    else if (key === 'lastSession') lastSession.value = value as Preferences['lastSession']
    
    savePreferences()
  }

  /**
   * 批量更新偏好设置
   */
  function updatePreferences(updates: Partial<Preferences>): void {
    Object.entries(updates).forEach(([key, value]) => {
      // 使用条件判断直接访问 ref
      if (key === 'launchMode' && value !== undefined) launchMode.value = value as Preferences['launchMode']
      else if (key === 'launchFolderPath' && value !== undefined) launchFolderPath.value = value as string
      else if (key === 'autoSave' && value !== undefined) autoSave.value = value as boolean
      else if (key === 'autoSaveInterval' && value !== undefined) autoSaveInterval.value = value as number
      else if (key === 'theme' && value !== undefined) theme.value = value as Preferences['theme']
      else if (key === 'showSidebar' && value !== undefined) showSidebar.value = value as boolean
      else if (key === 'showTabBar' && value !== undefined) showTabBar.value = value as boolean
      else if (key === 'showStatusBar' && value !== undefined) showStatusBar.value = value as boolean
      else if (key === 'hideScrollBars' && value !== undefined) hideScrollBars.value = value as boolean
      else if (key === 'isStickyNoteMode' && value !== undefined) isStickyNoteMode.value = value as boolean
      else if (key === 'isImmersiveMode' && value !== undefined) isImmersiveMode.value = value as boolean
      else if (key === 'typewriterMode' && value !== undefined) typewriterMode.value = value as boolean
      else if (key === 'focusMode' && value !== undefined) focusMode.value = value as boolean
      else if (key === 'fontSize' && value !== undefined) fontSize.value = value as number
      else if (key === 'wordWrap' && value !== undefined) wordWrap.value = value as boolean
      else if (key === 'imageInsertMode' && value !== undefined) imageInsertMode.value = value as Preferences['imageInsertMode']
      else if (key === 'imageStoragePath' && value !== undefined) imageStoragePath.value = value as string
      else if (key === 'language' && value !== undefined) language.value = value as Preferences['language']
      else if (key === 'devToolsOnStartup' && value !== undefined) devToolsOnStartup.value = value as boolean
      else if (key === 'openFileInNewWindow' && value !== undefined) openFileInNewWindow.value = value as boolean
      else if (key === 'openFolderInNewWindow' && value !== undefined) openFolderInNewWindow.value = value as boolean
      else if (key === 'lineEnding' && value !== undefined) lineEnding.value = value as Preferences['lineEnding']
      else if (key === 'recentFiles' && value !== undefined) recentFiles.value = value as RecentFile[]
      else if (key === 'maxRecentFiles' && value !== undefined) maxRecentFiles.value = value as number
      else if (key === 'recentFolders' && value !== undefined) recentFolders.value = value as RecentFolder[]
      else if (key === 'maxRecentFolders' && value !== undefined) maxRecentFolders.value = value as number
      else if (key === 'customThemePath' && value !== undefined) customThemePath.value = value as string
      else if (key === 'customThemes' && value !== undefined) customThemes.value = value as CustomTheme[]
      else if (key === 'lastSession' && value !== undefined) lastSession.value = value as Preferences['lastSession']
    })
    savePreferences()
  }

  /**
   * 重置为默认设置
   */
  function resetToDefaults(): void {
    updatePreferences(DEFAULT_PREFERENCES)
  }

  /**
   * 应用主题
   */
  function applyTheme(): void {
    const effectiveTheme = theme.value === UI.THEMES.SYSTEM 
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches 
          ? UI.THEMES.DARK 
          : UI.THEMES.LIGHT)
      : theme.value
    
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }

  /**
   * 切换主题
   */
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

  /**
   * 添加最近文件
   */
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
      
      // 限制最大数量
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

  /**
   * 移除最近文件
   */
  function removeRecentFile(filePath: string): void {
    const index = recentFiles.value.findIndex(f => f.filePath === filePath)
    if (index !== -1) {
      recentFiles.value.splice(index, 1)
      savePreferences()
    }
  }

  /**
   * 固定/取消固定最近文件
   */
  function pinRecentFile(filePath: string, pinned: boolean): void {
    const file = recentFiles.value.find(f => f.filePath === filePath)
    if (file) {
      file.pinned = pinned
      if (pinned) {
        // 将固定的移到前面
        const index = recentFiles.value.indexOf(file)
        recentFiles.value.splice(index, 1)
        const pinnedFiles = recentFiles.value.filter(f => f.pinned)
        const unpinnedFiles = recentFiles.value.filter(f => !f.pinned)
        recentFiles.value = [file, ...pinnedFiles, ...unpinnedFiles]
      }
      savePreferences()
    }
  }

  /**
   * 清空未固定的最近文件
   */
  function clearRecentFiles(): void {
    recentFiles.value = recentFiles.value.filter(f => f.pinned)
    savePreferences()
  }

  /**
   * 添加最近文件夹
   */
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

  /**
   * 移除最近文件夹
   */
  function removeRecentFolder(folderPath: string): void {
    const index = recentFolders.value.findIndex(f => f.folderPath === folderPath)
    if (index !== -1) {
      recentFolders.value.splice(index, 1)
      savePreferences()
    }
  }

  /**
   * 固定/取消固定最近文件夹
   */
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

  /**
   * 清空未固定的最近文件夹
   */
  function clearRecentFolders(): void {
    recentFolders.value = recentFolders.value.filter(f => f.pinned)
    savePreferences()
  }

  /**
   * 扫描并加载自定义主题目录中的主题
   */
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

  /**
   * 应用自定义主题
   */
  function applyCustomTheme(themeId: string): void {
    const customTheme = customThemes.value.find(t => t.id === themeId)
    if (!customTheme) return
    
    Object.entries(customTheme.colors).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value)
    })
    
    theme.value = `custom-${themeId}` as 'light' | 'dark' | 'system'
    savePreferences()
  }

  /**
   * 重置为内置主题
   */
  function resetToBuiltInTheme(): void {
    applyTheme()
    theme.value = DEFAULT_PREFERENCES.theme
    savePreferences()
  }
  
  /**
   * 切换悬浮便签模式
   */
  function toggleStickyNoteMode(): void {
    isStickyNoteMode.value = !isStickyNoteMode.value
    if (isStickyNoteMode.value) {
      // 进入悬浮便签模式时隐藏所有界面元素
      showSidebar.value = false
      showTabBar.value = false
      showStatusBar.value = false
    } else {
      // 退出悬浮便签模式时恢复默认界面
      showSidebar.value = DEFAULT_PREFERENCES.showSidebar
      showTabBar.value = DEFAULT_PREFERENCES.showTabBar
      showStatusBar.value = DEFAULT_PREFERENCES.showStatusBar
    }
    savePreferences()
  }
  
  /**
   * 切换沉浸式写作模式
   */
  function toggleImmersiveMode(): void {
    isImmersiveMode.value = !isImmersiveMode.value
    if (isImmersiveMode.value) {
      // 进入沉浸式写作模式
      showSidebar.value = false
      showTabBar.value = false
      showStatusBar.value = false
    } else {
      // 退出沉浸式写作模式
      showSidebar.value = DEFAULT_PREFERENCES.showSidebar
      showTabBar.value = DEFAULT_PREFERENCES.showTabBar
      showStatusBar.value = DEFAULT_PREFERENCES.showStatusBar
    }
    savePreferences()
  }

  /**
   * 保存当前会话状态
   */
  function saveSession(data: {
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
  }): void {
    lastSession.value = data
    savePreferences()
  }

  /**
   * 获取保存的会话
   */
  function getLastSession(): Preferences['lastSession'] {
    return lastSession.value
  }

  /**
   * 清除会话
   */
  function clearSession(): void {
    lastSession.value = undefined
    savePreferences()
  }

  /**
   * 保存偏好设置到 localStorage
   */
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

  /**
   * 从 localStorage 加载偏好设置
   */
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

  // 导出 store 引用供内部使用
  const preferencesStore = {
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
    lastSession
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
