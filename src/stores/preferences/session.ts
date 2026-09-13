import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface LastSession {
  tabs: Array<{
    title: string
    content: string
    filePath: string | null
    viewMode: string
    splitRatio?: number
    isDirty: boolean
    cursor: { from: number; to: number }
  }>
  activeTabId?: string
  currentFolder?: string
}

export const useSessionPreferencesStore = defineStore('preferences-session', () => {
  const lastSession = ref<LastSession | undefined>(undefined)

  function applyPatch(patch: Partial<{ lastSession: LastSession }>): void {
    if (patch.lastSession !== undefined) lastSession.value = patch.lastSession
  }

  function saveSession(data: LastSession): void {
    lastSession.value = data
  }

  function getLastSession(): LastSession | undefined {
    return lastSession.value
  }

  function clearSession(): void {
    lastSession.value = undefined
  }

  return {
    lastSession,
    applyPatch,
    saveSession,
    getLastSession,
    clearSession,
  }
})
