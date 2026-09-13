import type { Theme } from '@shared/types'

export interface IThemeService {
  applyTheme(theme: Theme): void
  getCurrentTheme(): Theme
  onThemeChange(callback: (theme: Theme) => void): () => void
  getSystemTheme(): 'light' | 'dark'
}
