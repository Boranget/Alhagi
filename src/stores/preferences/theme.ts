import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { UI } from '@/constants'
import { useThemeService } from '@/services/theme/ThemeService'

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

export const useThemePreferencesStore = defineStore('preferences-theme', () => {
  const theme = ref<string>(UI.THEMES.LIGHT)
  const showMenuBar = ref<boolean>(true)
  const hideScrollBars = ref<boolean>(false)
  const customThemePath = ref<string>('')
  const customThemes = ref<CustomTheme[]>([])

  const { applyTheme, toggleLightDark } = useThemeService()

  watch(theme, () => {
    applyTheme()
  }, { immediate: true })

  function applyPatch(patch: Partial<{
    theme: string
    showMenuBar: boolean
    hideScrollBars: boolean
    customThemePath: string
    customThemes: CustomTheme[]
  }>): void {
    if (patch.theme !== undefined) theme.value = patch.theme
    if (patch.showMenuBar !== undefined) showMenuBar.value = patch.showMenuBar
    if (patch.hideScrollBars !== undefined) hideScrollBars.value = patch.hideScrollBars
    if (patch.customThemePath !== undefined) customThemePath.value = patch.customThemePath
    if (patch.customThemes !== undefined) customThemes.value = patch.customThemes
  }

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
                  themes.push({ id: entry.path, name: themeData.name, path: entry.path, colors: themeData.colors })
                }
              } catch { /* skip invalid */ }
            }
          }
        }
        customThemes.value = themes
      }
    } catch { /* silent */ }
  }

  function applyCustomTheme(themeId: string): void {
    const customTheme = customThemes.value.find((t) => t.id === themeId)
    if (!customTheme) return
    Object.entries(customTheme.colors).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value as string)
    })
    theme.value = `custom-${themeId}`
  }

  function resetToBuiltInTheme(): void {
    theme.value = UI.THEMES.LIGHT
  }

  return {
    theme,
    showMenuBar,
    hideScrollBars,
    customThemePath,
    customThemes,
    applyPatch,
    loadCustomThemes,
    applyCustomTheme,
    resetToBuiltInTheme,
    toggleLightDark,
  }
})
