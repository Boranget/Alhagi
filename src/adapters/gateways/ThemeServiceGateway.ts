import type { IThemeService } from '@core/interfaces/services/IThemeService'
import type { Theme } from '@shared/types'
import { ref } from 'vue'
import { UI } from '@/constants'

export class ThemeServiceGateway implements IThemeService {
  private systemThemeListener = ref<((event: MediaQueryListEvent) => void) | null>(null)
  private currentTheme: Theme = 'system'

  applyTheme(theme: Theme): void {
    this.currentTheme = theme

    const effectiveTheme = theme === UI.THEMES.SYSTEM
      ? (window.matchMedia?.('prefers-color-scheme: dark').matches
          ? UI.THEMES.DARK
          : UI.THEMES.LIGHT)
      : theme

    document.documentElement.setAttribute('data-theme', effectiveTheme)
    document.documentElement.classList.toggle('dark', effectiveTheme === UI.THEMES.DARK)

    if (window.electronAPI) {
      window.electronAPI.setTheme(theme as 'light' | 'dark' | 'system')
    }
  }

  getCurrentTheme(): Theme {
    return this.currentTheme
  }

  onThemeChange(callback: (theme: Theme) => void): () => void {
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme') as Theme
      if (currentTheme) {
        callback(currentTheme)
      }
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => observer.disconnect()
  }

  getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia?.('prefers-color-scheme: dark').matches ? 'dark' : 'light'
  }

  subscribeToSystemTheme(): void {
    this.unsubscribeFromSystemTheme()

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    this.systemThemeListener.value = (event: MediaQueryListEvent) => {
      if (this.currentTheme === UI.THEMES.SYSTEM) {
        const newTheme = event.matches ? UI.THEMES.DARK : UI.THEMES.LIGHT
        document.documentElement.setAttribute('data-theme', newTheme)
        document.documentElement.classList.toggle('dark', newTheme === UI.THEMES.DARK)
        if (window.electronAPI) {
          window.electronAPI.setTheme(this.currentTheme as 'light' | 'dark' | 'system')
        }
      }
    }

    media.addEventListener('change', this.systemThemeListener.value)
  }

  unsubscribeFromSystemTheme(): void {
    if (this.systemThemeListener.value) {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      media.removeEventListener('change', this.systemThemeListener.value)
      this.systemThemeListener.value = null
    }
  }
}

let instance: ThemeServiceGateway | null = null

export function useThemeServiceGateway(): ThemeServiceGateway {
  if (!instance) {
    instance = new ThemeServiceGateway()
  }
  return instance
}
