import type { IPreferenceQueries } from '@core/domain/ports/queries/IPreferenceQueries'
import type { PreferencesProps } from '@core/entities/Preferences'
import { usePreferencesStore } from '@/stores/preferences'

export function usePreferenceQueries(): IPreferenceQueries {
  const store = usePreferencesStore()

  return {
    get: <K extends keyof PreferencesProps>(key: K): PreferencesProps[K] => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (store as any)[key as string] as PreferencesProps[K]
    },
    getAll: (): PreferencesProps => {
      return {
        theme: store.theme as PreferencesProps['theme'],
        zoom: store.zoom,
        fontSize: store.fontSize,
        lineHeight: store.lineHeight,
        wordCountDisplayType: store.wordCountDisplayType as PreferencesProps['wordCountDisplayType'],
        autoSave: store.autoSave,
        autoSaveInterval: store.autoSaveInterval,
        language: store.language,
        showMenuBar: store.showMenuBar,
        hideScrollBars: store.hideScrollBars,
        recentFiles: store.recentFiles as unknown as string[],
        recentFolders: store.recentFolders as unknown as string[],
        customThemes: store.customThemes as unknown as Record<string, string>,
        launchMode: store.launchMode as PreferencesProps['launchMode'],
        launchFolderPath: store.launchFolderPath || '',
        lineEnding: store.lineEnding,
      }
    },
  }
}
