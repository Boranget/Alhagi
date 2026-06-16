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
    const next = themes[nextIndex]
    // Single-writer: setOne → IPC → 主进程广播 → 本地 ref 更新 → watch(theme) → applyTheme
    preferences.setOne('theme', next)

    if (next === UI.THEMES.SYSTEM) {
      subscribeToSystemTheme()
    } else {
      unsubscribeFromSystemTheme()
    }
  }

  function toggleLightDark(): void {
    const currentTheme = preferences.theme === UI.THEMES.SYSTEM
      ? (window.matchMedia?.('prefers-color-scheme: dark').matches
          ? UI.THEMES.DARK
          : UI.THEMES.LIGHT)
      : preferences.theme

    // Single-writer: setOne 唯一入口
    preferences.setOne('theme', currentTheme === UI.THEMES.DARK ? UI.THEMES.LIGHT : UI.THEMES.DARK)
  }

  return {
    applyTheme,
    subscribeToSystemTheme,
    unsubscribeFromSystemTheme,
    toggleTheme,
    toggleLightDark
  }
}
