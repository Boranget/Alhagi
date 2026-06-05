import { ref } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { UI } from '@/constants'

export function useThemeService() {
  const preferences = usePreferencesStore()
  const systemThemeListener = ref<((event: MediaQueryListEvent) => void) | null>(null)

  function applyTheme(): void {
    const effectiveTheme = preferences.theme === UI.THEMES.SYSTEM
      ? (window.matchMedia?.('prefers-color-scheme: dark').matches
          ? UI.THEMES.DARK
          : UI.THEMES.LIGHT)
      : preferences.theme

    document.documentElement.setAttribute('data-theme', effectiveTheme)
    document.documentElement.classList.toggle('dark', effectiveTheme === UI.THEMES.DARK)
    
    // 通知 Electron 主进程更新窗口背景色
    if (window.electronAPI) {
      window.electronAPI.setTheme(preferences.theme as 'light' | 'dark' | 'system')
    }
  }

  function subscribeToSystemTheme(): void {
    unsubscribeFromSystemTheme()
    
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    systemThemeListener.value = (event: MediaQueryListEvent) => {
      if (preferences.theme === UI.THEMES.SYSTEM) {
        const newTheme = event.matches ? UI.THEMES.DARK : UI.THEMES.LIGHT
        document.documentElement.setAttribute('data-theme', newTheme)
        document.documentElement.classList.toggle('dark', newTheme === UI.THEMES.DARK)
        // 通知 Electron 主进程更新窗口背景色
        if (window.electronAPI) {
          window.electronAPI.setTheme(preferences.theme as 'light' | 'dark' | 'system')
        }
      }
    }
    
    media.addEventListener('change', systemThemeListener.value)
  }

  function unsubscribeFromSystemTheme(): void {
    if (systemThemeListener.value) {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      media.removeEventListener('change', systemThemeListener.value)
      systemThemeListener.value = null
    }
  }

  function toggleTheme(): void {
    const themes: Array<'light' | 'dark' | 'system'> = [
      UI.THEMES.LIGHT,
      UI.THEMES.DARK,
      UI.THEMES.SYSTEM
    ]
    const currentIndex = themes.indexOf(preferences.theme as 'light' | 'dark' | 'system')
    const nextIndex = (currentIndex + 1) % themes.length
    preferences.theme = themes[nextIndex]
    applyTheme()
    
    if (preferences.theme === UI.THEMES.SYSTEM) {
      subscribeToSystemTheme()
    } else {
      unsubscribeFromSystemTheme()
    }
    
    preferences.savePreferences()
  }

  function toggleLightDark(): void {
    const currentTheme = preferences.theme === UI.THEMES.SYSTEM
      ? (window.matchMedia?.('prefers-color-scheme: dark').matches
          ? UI.THEMES.DARK
          : UI.THEMES.LIGHT)
      : preferences.theme
    
    preferences.theme = currentTheme === UI.THEMES.DARK ? UI.THEMES.LIGHT : UI.THEMES.DARK
    applyTheme()
    preferences.savePreferences()
  }

  return {
    applyTheme,
    subscribeToSystemTheme,
    unsubscribeFromSystemTheme,
    toggleTheme,
    toggleLightDark
  }
}
