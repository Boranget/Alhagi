import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RecentFile } from '@/types'
import { errorManager, ErrorCode, ErrorSeverity } from '@/services/errorHandler'
import { UI, EDITOR, AUTO_SAVE, I18N, IMAGE, LAUNCH } from '@/constants'

/**
 * Preferences Store
 * 管理应用程序的所有用户偏好设置
 * 使用统一的状态管理和持久化机制
 */

export interface Preferences {
  // 启动设置
  launchMode: 'restore' | 'welcome' | 'blank'
  
  // 保存设置
  autoSave: boolean
  autoSaveInterval: number
  
  // 外观设置
  theme: 'light' | 'dark' | 'system'
  showSidebar: boolean
  showStatusBar: boolean
  hideScrollBars: boolean
  
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
  
  // 最近文件
  recentFiles: RecentFile[]
  maxRecentFiles: number
}

/**
 * 默认偏好设置
 */
const DEFAULT_PREFERENCES: Preferences = {
  launchMode: LAUNCH.MODES.RESTORE,
  autoSave: true,
  autoSaveInterval: AUTO_SAVE.DEFAULT_INTERVAL,
  theme: UI.THEMES.LIGHT,
  showSidebar: true,
  showStatusBar: true,
  hideScrollBars: false,
  typewriterMode: false,
  focusMode: false,
  fontSize: EDITOR.DEFAULT_FONT_SIZE,
  wordWrap: true,
  imageInsertMode: IMAGE.INSERT_MODES.KEEP_ORIGINAL,
  imageStoragePath: '',
  language: I18N.DEFAULT_LANGUAGE,
  devToolsOnStartup: false,
  recentFiles: [],
  maxRecentFiles: 20
}

const STORAGE_KEY = 'alhagi-preferences'

/**
 * Preferences Store
 * 提供类型安全的偏好设置管理
 */
export const usePreferencesStore = defineStore('preferences', () => {
  // 状态
  const launchMode = ref<Preferences['launchMode']>(DEFAULT_PREFERENCES.launchMode)
  const autoSave = ref<boolean>(DEFAULT_PREFERENCES.autoSave)
  const autoSaveInterval = ref<number>(DEFAULT_PREFERENCES.autoSaveInterval)
  const theme = ref<Preferences['theme']>(DEFAULT_PREFERENCES.theme)
  const showSidebar = ref<boolean>(DEFAULT_PREFERENCES.showSidebar)
  const showStatusBar = ref<boolean>(DEFAULT_PREFERENCES.showStatusBar)
  const hideScrollBars = ref<boolean>(DEFAULT_PREFERENCES.hideScrollBars)
  const typewriterMode = ref<boolean>(DEFAULT_PREFERENCES.typewriterMode)
  const focusMode = ref<boolean>(DEFAULT_PREFERENCES.focusMode)
  const fontSize = ref<number>(DEFAULT_PREFERENCES.fontSize)
  const wordWrap = ref<boolean>(DEFAULT_PREFERENCES.wordWrap)
  const imageInsertMode = ref<Preferences['imageInsertMode']>(DEFAULT_PREFERENCES.imageInsertMode)
  const imageStoragePath = ref<string>(DEFAULT_PREFERENCES.imageStoragePath)
  const language = ref<Preferences['language']>(DEFAULT_PREFERENCES.language)
  const devToolsOnStartup = ref<boolean>(DEFAULT_PREFERENCES.devToolsOnStartup)
  const recentFiles = ref<RecentFile[]>(DEFAULT_PREFERENCES.recentFiles)
  const maxRecentFiles = ref<number>(DEFAULT_PREFERENCES.maxRecentFiles)

  /**
   * 获取当前所有偏好设置
   */
  function getAllPreferences(): Preferences {
    return {
      launchMode: launchMode.value,
      autoSave: autoSave.value,
      autoSaveInterval: autoSaveInterval.value,
      theme: theme.value,
      showSidebar: showSidebar.value,
      showStatusBar: showStatusBar.value,
      hideScrollBars: hideScrollBars.value,
      typewriterMode: typewriterMode.value,
      focusMode: focusMode.value,
      fontSize: fontSize.value,
      wordWrap: wordWrap.value,
      imageInsertMode: imageInsertMode.value,
      imageStoragePath: imageStoragePath.value,
      language: language.value,
      devToolsOnStartup: devToolsOnStartup.value,
      recentFiles: recentFiles.value,
      maxRecentFiles: maxRecentFiles.value
    }
  }

  /**
   * 设置单个偏好项
   */
  function setPreference<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ): void {
    if (key in preferencesStore) {
      (preferencesStore as Record<string, unknown>)[key] = value
      savePreferences()
    }
  }

  /**
   * 批量更新偏好设置
   */
  function updatePreferences(updates: Partial<Preferences>): void {
    Object.entries(updates).forEach(([key, value]) => {
      if (key in preferencesStore) {
        (preferencesStore as Record<string, unknown>)[key] = value
      }
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
      errorManager.createError(
        ErrorCode.FILE_READ_ERROR,
        '加载偏好设置失败，使用默认设置',
        ErrorSeverity.WARNING,
        { context: 'preferences.loadPreferences', error }
      )
      applyTheme()
    }
  }

  // 导出 store 引用供内部使用
  const preferencesStore = {
    launchMode,
    autoSave,
    autoSaveInterval,
    theme,
    showSidebar,
    showStatusBar,
    hideScrollBars,
    typewriterMode,
    focusMode,
    fontSize,
    wordWrap,
    imageInsertMode,
    imageStoragePath,
    language,
    devToolsOnStartup,
    recentFiles,
    maxRecentFiles
  }

  return {
    // Getters
    launchMode,
    autoSave,
    autoSaveInterval,
    theme,
    showSidebar,
    showStatusBar,
    hideScrollBars,
    typewriterMode,
    focusMode,
    fontSize,
    wordWrap,
    imageInsertMode,
    imageStoragePath,
    language,
    devToolsOnStartup,
    recentFiles,
    maxRecentFiles,
    
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
    savePreferences,
    loadPreferences
  }
})
