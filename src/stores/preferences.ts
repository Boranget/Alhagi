import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePreferencesStore = defineStore('preferences', () => {
  const autoSave = ref(true)
  const autoSaveDelay = ref(1000)
  const hideScrollbar = ref(false)
  const typewriterMode = ref(false)
  const focusMode = ref(false)
  const showStatusbar = ref(true)
  const showSidebar = ref(true)
  const wordWrap = ref(true)
  const theme = ref<'light' | 'dark'>('light')
  const language = ref<'zh-CN' | 'en-US'>('zh-CN')

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

  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme
    document.documentElement.setAttribute('data-theme', newTheme)
    savePreferences()
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  function setLanguage(lang: 'zh-CN' | 'en-US') {
    language.value = lang
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
      language: language.value
    }))
  }

  function loadPreferences() {
    const saved = localStorage.getItem('alhagi-preferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        Object.assign(autoSave, prefs.autoSave)
        Object.assign(autoSaveDelay, prefs.autoSaveDelay)
        Object.assign(hideScrollbar, prefs.hideScrollbar)
        Object.assign(typewriterMode, prefs.typewriterMode)
        Object.assign(focusMode, prefs.focusMode)
        Object.assign(showStatusbar, prefs.showStatusbar)
        Object.assign(showSidebar, prefs.showSidebar)
        Object.assign(wordWrap, prefs.wordWrap)
        Object.assign(theme, prefs.theme)
        Object.assign(language, prefs.language)
        document.documentElement.setAttribute('data-theme', prefs.theme || 'light')
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
    savePreferences,
    loadPreferences
  }
})
