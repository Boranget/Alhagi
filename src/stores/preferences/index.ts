import { useEditorPreferencesStore } from './editor'
import { useThemePreferencesStore } from './theme'
import { useRecentPreferencesStore } from './recent'
import { useSessionPreferencesStore } from './session'
import { useGeneralPreferencesStore } from './general'

export {
  useEditorPreferencesStore,
  useThemePreferencesStore,
  useRecentPreferencesStore,
  useSessionPreferencesStore,
  useGeneralPreferencesStore,
}

export function useAllPreferencesStores() {
  const editor = useEditorPreferencesStore()
  const theme = useThemePreferencesStore()
  const recent = useRecentPreferencesStore()
  const session = useSessionPreferencesStore()
  const general = useGeneralPreferencesStore()

  return {
    editor,
    theme,
    recent,
    session,
    general,
  }
}
