import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RecentFile } from '@/types'

export const usePreferencesStore = defineStore('preferences', () => {
  const autoSave = ref(true)
  const autoSaveDelay = ref(1000)
  const hideScrollbar = ref(false)
  const typewriterMode = ref(false)
  const focusMode = ref(false)
  const showStatusbar = ref(true)
  const showSidebar = ref(true)
  const wordWrap = ref(true)
  const theme = ref<'light' | 'dark' | 'system'>('light')
  const language = ref<'zh-CN' | 'en-US'>('zh-CN')
  const recentFiles = ref<RecentFile[]>([])
  const maxRecentFiles = ref(20)

  function setAutoSave(enabled: boolean) {
    autoSave.value = enabled
    savePreferences()
  }

  function setAutoSaveDelay(delay: number) {
    autoSaveDelay.value = delay
    savePreferences()
  }

  function setHideScrollbar(hide: boolean) {
    hideScrollbar.value = hide
    savePreferences()
  }

  function setTypewriterMode(enabled: boolean) {
    typewriterMode.value = enabled
    savePreferences()
  }

  function setFocusMode(enabled: boolean) {
    focusMode.value = enabled
    savePreferences()
  }

  function setShowStatusbar(show: boolean) {
    showStatusbar.value = show
    savePreferences()
  }

  function setShowSidebar(show: boolean) {
    showSidebar.value = show
    savePreferences()
  }

  function setWordWrap(wrap: boolean) {
    wordWrap.value = wrap
    savePreferences()
  }

  function setTheme(newTheme: 'light' | 'dark' | 'system') {
    theme.value = newTheme
    document.documentElement.setAttribute('data-theme', newTheme === 'system' ? 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
      newTheme)
    savePreferences()
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  function setLanguage(lang: 'zh-CN' | 'en-US') {
    language.value = lang
    savePreferences()
  }

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

  function savePreferences() {
    localStorage.setItem('alhagi-preferences', JSON.stringify({
      autoSave: autoSave.value,
      autoSaveDelay: autoSaveDelay.value,
      hideScrollbar: hideScrollbar.value,
      typewriterMode: typewriterMode.value,
      focusMode: focusMode.value,
      showStatusbar: showStatusbar.value,
      showSidebar: showSidebar.value,
      wordWrap: wordWrap.value,
      theme: theme.value,
      language: language.value,
      recentFiles: recentFiles.value,
      maxRecentFiles: maxRecentFiles.value
    }))
  }

  function loadPreferences() {
    const saved = localStorage.getItem('alhagi-preferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        autoSave.value = prefs.autoSave ?? true
        autoSaveDelay.value = prefs.autoSaveDelay ?? 1000
        hideScrollbar.value = prefs.hideScrollbar ?? false
        typewriterMode.value = prefs.typewriterMode ?? false
        focusMode.value = prefs.focusMode ?? false
        showStatusbar.value = prefs.showStatusbar ?? true
        showSidebar.value = prefs.showSidebar ?? true
        wordWrap.value = prefs.wordWrap ?? true
        theme.value = prefs.theme ?? 'light'
        language.value = prefs.language ?? 'zh-CN'
        recentFiles.value = prefs.recentFiles ?? []
        maxRecentFiles.value = prefs.maxRecentFiles ?? 20
        document.documentElement.setAttribute('data-theme', 
          theme.value === 'system' ? 
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
            theme.value)
      } catch (e) {
        console.error('Failed to load preferences:', e)
      }
    }
  }

  return {
    autoSave,
    autoSaveDelay,
    hideScrollbar,
    typewriterMode,
    focusMode,
    showStatusbar,
    showSidebar,
    wordWrap,
    theme,
    language,
    recentFiles,
    maxRecentFiles,
    setAutoSave,
    setAutoSaveDelay,
    setHideScrollbar,
    setTypewriterMode,
    setFocusMode,
    setShowStatusbar,
    setShowSidebar,
    setWordWrap,
    setTheme,
    toggleTheme,
    setLanguage,
    addRecentFile,
    removeRecentFile,
    pinRecentFile,
    clearRecentFiles,
    savePreferences,
    loadPreferences
  }
})
