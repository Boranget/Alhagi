// ============================================================
// Alhagi ThemeService - 主进程主题状态与窗口背景色
// ============================================================

import { nativeTheme, BrowserWindow } from 'electron'
import type { PreferenceStore } from './PreferenceStore'

export type ThemeMode = 'light' | 'dark' | 'system'

export class ThemeService {
  constructor(private prefs: PreferenceStore) {}

  getEffectiveTheme(): 'light' | 'dark' {
    const theme = this.prefs.getTheme()
    if (theme === 'system') {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    }
    return theme
  }

  getBackgroundColor(theme?: ThemeMode): string {
    const t = theme ?? this.prefs.getTheme()
    const effective = t === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : t
    return effective === 'dark' ? '#2e3440' : '#ffffff'
  }

  setTheme(theme: ThemeMode, windows: Map<number, BrowserWindow>): void {
    this.prefs.setTheme(theme)
    nativeTheme.themeSource = theme === 'system' ? 'system' : theme
    const backgroundColor = this.getBackgroundColor(theme)
    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.setBackgroundColor(backgroundColor)
      }
    })
  }
}
