import type { PreferencesProps } from '@core/entities/Preferences'
import type { Theme } from '@shared/types'

export interface IPreferencesRepository {
  get<K extends keyof PreferencesProps>(key: K): PreferencesProps[K]
  set<K extends keyof PreferencesProps>(key: K, value: PreferencesProps[K]): Promise<void>
  setMany(prefs: Partial<PreferencesProps>): Promise<void>
  getAll(): PreferencesProps
  subscribe(listener: (patch: Partial<PreferencesProps>) => void): () => void
  addRecentFile(filePath: string): Promise<void>
  addRecentFolder(folderPath: string): Promise<void>
  removeRecentFile(filePath: string): Promise<void>
  removeRecentFolder(folderPath: string): Promise<void>
  zoomIn(): Promise<void>
  zoomOut(): Promise<void>
  resetZoom(): Promise<void>
  toggleLightDark(): Promise<void>
  toggleWordCountDisplayType(): Promise<void>
  applyTheme(theme: Theme): void
}
