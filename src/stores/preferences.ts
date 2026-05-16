import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RecentFile } from '@/types'

export const usePreferencesStore = defineStore('preferences', () => {
  // 启动设置
  const launchMode = ref<'restore' | 'welcome' | 'blank'>('restore')
  
  // 保存设置
  const autoSave = ref(true)
  const autoSaveInterval = ref(30) // 秒
  
  // 外观设置
  const theme = ref<'light' | 'dark' | 'system'>('light')
  const showSidebar = ref(true)
  const showStatusBar = ref(true)
  const hideScrollBars = ref(false)
  
  // 编辑器设置
  const typewriterMode = ref(false)
  const focusMode = ref(false)
  const fontSize = ref(14)
  const wordWrap = ref(true)
  
  // 图片设置
  const imageInsertMode = ref<'keep-original' | 'copy-absolute' | 'copy-relative'>('keep-original')
  const imageStoragePath = ref('')
  
  // 语言设置
  const language = ref<'zh-CN' | 'en'>('zh-CN')
  
  // 开发设置
  const devToolsOnStartup = ref(false)
  
  // 最近文件
  const recentFiles = ref<RecentFile[]>([])
  const maxRecentFiles = ref(20)

  // 启动行为
  function setLaunchMode(mode: 'restore' | 'welcome' | 'blank') {
    launchMode.value = mode
    savePreferences()
  }

  // 保存设置
  function setAutoSave(enabled: boolean) {
    autoSave.value = enabled
    savePreferences()
  }

  function setAutoSaveInterval(interval: number) {
    autoSaveInterval.value = interval
    savePreferences()
  }

  // 外观设置
  function setTheme(newTheme: 'light' | 'dark' | 'system') {
    theme.value = newTheme
    applyTheme()
    savePreferences()
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : theme.value === 'dark' ? 'system' : 'light')
  }

  function setShowSidebar(show: boolean) {
    showSidebar.value = show
    savePreferences()
  }

  function setShowStatusBar(show: boolean) {
    showStatusBar.value = show
    savePreferences()
  }

  function setHideScrollBars(hide: boolean) {
    hideScrollBars.value = hide
    savePreferences()
  }

  // 编辑器设置
  function setTypewriterMode(enabled: boolean) {
    typewriterMode.value = enabled
    savePreferences()
  }

  function setFocusMode(enabled: boolean) {
    focusMode.value = enabled
    savePreferences()
  }

  function setFontSize(size: number) {
    fontSize.value = size
    savePreferences()
  }

  function setWordWrap(wrap: boolean) {
    wordWrap.value = wrap
    savePreferences()
  }

  // 图片设置
  function setImageInsertMode(mode: 'keep-original' | 'copy-absolute' | 'copy-relative') {
    imageInsertMode.value = mode
    savePreferences()
  }

  function setImageStoragePath(path: string) {
    imageStoragePath.value = path
    savePreferences()
  }

  // 语言设置
  function setLanguage(lang: 'zh-CN' | 'en') {
    language.value = lang
    savePreferences()
  }

  // 开发设置
  function setDevToolsOnStartup(enabled: boolean) {
    devToolsOnStartup.value = enabled
    savePreferences()
  }

  // 最近文件
  function addRecentFile(filePath: string, title: string) {
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

  function removeRecentFile(filePath: string) {
    const index = recentFiles.value.findIndex(f => f.filePath === filePath)
    if (index !== -1) {
      recentFiles.value.splice(index, 1)
      savePreferences()
    }
  }

  function pinRecentFile(filePath: string, pinned: boolean) {
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

  function clearRecentFiles() {
    recentFiles.value = recentFiles.value.filter(f => f.pinned)
    savePreferences()
  }

  function applyTheme() {
    const effectiveTheme = theme.value === 'system' 
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme.value
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }

  function savePreferences() {
    localStorage.setItem('alhagi-preferences', JSON.stringify({
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
    }))
  }

  function loadPreferences() {
    const saved = localStorage.getItem('alhagi-preferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        launchMode.value = prefs.launchMode ?? 'restore'
        autoSave.value = prefs.autoSave ?? true
        autoSaveInterval.value = prefs.autoSaveInterval ?? 30
        theme.value = prefs.theme ?? 'light'
        showSidebar.value = prefs.showSidebar ?? true
        showStatusBar.value = prefs.showStatusBar ?? true
        hideScrollBars.value = prefs.hideScrollBars ?? false
        typewriterMode.value = prefs.typewriterMode ?? false
        focusMode.value = prefs.focusMode ?? false
        fontSize.value = prefs.fontSize ?? 14
        wordWrap.value = prefs.wordWrap ?? true
        imageInsertMode.value = prefs.imageInsertMode ?? 'keep-original'
        imageStoragePath.value = prefs.imageStoragePath ?? ''
        language.value = prefs.language ?? 'zh-CN'
        devToolsOnStartup.value = prefs.devToolsOnStartup ?? false
        recentFiles.value = prefs.recentFiles ?? []
        maxRecentFiles.value = prefs.maxRecentFiles ?? 20
        applyTheme()
      } catch (e) {
        console.error('Failed to load preferences:', e)
      }
    }
  }

  return {
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
    setLaunchMode,
    setAutoSave,
    setAutoSaveInterval,
    setTheme,
    toggleTheme,
    setShowSidebar,
    setShowStatusBar,
    setHideScrollBars,
    setTypewriterMode,
    setFocusMode,
    setFontSize,
    setWordWrap,
    setImageInsertMode,
    setImageStoragePath,
    setLanguage,
    setDevToolsOnStartup,
    addRecentFile,
    removeRecentFile,
    pinRecentFile,
    clearRecentFiles,
    savePreferences,
    loadPreferences
  }
})
