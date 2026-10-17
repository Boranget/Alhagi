import type { IPreferencesRepository } from '@core/domain/ports/repositories/IPreferencesRepository'
import type { PreferencesProps } from '@core/entities/Preferences'
import type { Preferences } from '@/stores/preferences'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePreferencesStore as useOriginalPreferencesStore } from '@/stores/preferences'

export const usePreferencesRepository = defineStore('preferencesRepo', (): IPreferencesRepository => {
  const originalStore = useOriginalPreferencesStore()

  const get = <K extends keyof PreferencesProps>(key: K): PreferencesProps[K] => {
    return (originalStore as unknown as PreferencesProps)[key]
  }

  const set = async <K extends keyof PreferencesProps>(key: K, value: PreferencesProps[K]): Promise<void> => {
    const storeKey = key as keyof Preferences
    await originalStore.setOne(storeKey, value as unknown as Preferences[typeof storeKey])
  }

  const setMany = async (prefs: Partial<PreferencesProps>): Promise<void> => {
    await originalStore.setMany(prefs as unknown as Parameters<typeof originalStore.setMany>[0])
  }

  const getAll = (): PreferencesProps => {
    return originalStore as unknown as PreferencesProps
  }

  const subscribe = (listener: (patch: Partial<PreferencesProps>) => void): (() => void) => {
    return originalStore.$onAction(({ name, args }) => {
      if (name === 'setOne') {
        const key = args[0] as string
        const value = args[1]
        listener({ [key]: value } as Partial<PreferencesProps>)
      }
    })
  }

  const addRecentFile = async (filePath: string): Promise<void> => {
    await originalStore.addRecentFile(filePath, filePath)
  }

  const addRecentFolder = async (folderPath: string): Promise<void> => {
    await originalStore.addRecentFolder(folderPath, folderPath)
  }

  const removeRecentFile = async (filePath: string): Promise<void> => {
    await originalStore.removeRecentFile(filePath)
  }

  const removeRecentFolder = async (folderPath: string): Promise<void> => {
    await originalStore.removeRecentFolder(folderPath)
  }

  const zoomIn = async (): Promise<void> => {
    originalStore.zoomIn()
  }

  const zoomOut = async (): Promise<void> => {
    originalStore.zoomOut()
  }

  const resetZoom = async (): Promise<void> => {
    originalStore.resetZoom()
  }

  const toggleLightDark = async (): Promise<void> => {
    originalStore.toggleLightDark()
  }

  const toggleWordCountDisplayType = async (): Promise<void> => {
    originalStore.toggleWordCountDisplayType()
  }

  const applyTheme = (): void => {
    originalStore.applyTheme()
  }

  return {
    get,
    set,
    setMany,
    getAll,
    subscribe,
    addRecentFile,
    addRecentFolder,
    removeRecentFile,
    removeRecentFolder,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleLightDark,
    toggleWordCountDisplayType,
    applyTheme,
  }
})
