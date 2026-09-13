import { UpdatePreference } from '@core/use-cases/preferences/UpdatePreference'
import { SyncPreferences } from '@core/use-cases/preferences/SyncPreferences'
import { usePreferencesRepository } from '@adapters/stores/preferences'
import type { PreferencesProps } from '@core/entities/Preferences'
import type { Theme } from '@shared/types'
import { onUnmounted } from 'vue'

export function usePreferences() {
  const preferencesRepository = usePreferencesRepository()

  const updatePreference = new UpdatePreference(preferencesRepository)
  const syncPreferences = new SyncPreferences(preferencesRepository)

  syncPreferences.start()

  onUnmounted(() => {
    syncPreferences.stop()
  })

  return {
    get: <K extends keyof PreferencesProps>(key: K) => preferencesRepository.get(key),
    set: <K extends keyof PreferencesProps>(key: K, value: PreferencesProps[K]) => updatePreference.execute(key, value),
    setMany: (prefs: Partial<PreferencesProps>) => preferencesRepository.setMany(prefs),
    getAll: () => preferencesRepository.getAll(),
    addRecentFile: (filePath: string) => preferencesRepository.addRecentFile(filePath),
    addRecentFolder: (folderPath: string) => preferencesRepository.addRecentFolder(folderPath),
    removeRecentFile: (filePath: string) => preferencesRepository.removeRecentFile(filePath),
    removeRecentFolder: (folderPath: string) => preferencesRepository.removeRecentFolder(folderPath),
    zoomIn: () => preferencesRepository.zoomIn(),
    zoomOut: () => preferencesRepository.zoomOut(),
    resetZoom: () => preferencesRepository.resetZoom(),
    toggleLightDark: () => preferencesRepository.toggleLightDark(),
    toggleWordCountDisplayType: () => preferencesRepository.toggleWordCountDisplayType(),
    applyTheme: (theme: Theme) => preferencesRepository.applyTheme(theme),
  }
}
