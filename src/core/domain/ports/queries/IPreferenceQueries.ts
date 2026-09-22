import type { PreferencesProps } from '@core/entities/Preferences'

export interface IPreferenceQueries {
  get<K extends keyof PreferencesProps>(key: K): PreferencesProps[K]
  getAll(): PreferencesProps
}
