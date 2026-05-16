import { ref, watch, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { debounce } from '@/utils/helpers'

export function useAutoSave() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const isAutoSaving = ref(false)
  const lastAutoSaveTime = ref<number | null>(null)
  const autoSaveError = ref<string | null>(null)

  let debouncedSave: (() => void) | null = null

  function setupAutoSave() {
    if (!prefsStore.autoSave) return

    debouncedSave = debounce(async () => {
      await performAutoSave()
    }, prefsStore.autoSaveDelay)
  }

  async function performAutoSave() {
    const activeTab = tabsStore.activeTab
    
    if (!activeTab || !activeTab.isDirty || !activeTab.filePath) {
      return
    }

    isAutoSaving.value = true
    autoSaveError.value = null

    try {
      const success = await tabsStore.saveFile(activeTab.id)
      if (success) {
        lastAutoSaveTime.value = Date.now()
      } else {
        autoSaveError.value = 'Failed to auto-save'
      }
    } catch (e) {
      autoSaveError.value = `Auto-save error: ${e}`
      console.error('Auto-save failed:', e)
    } finally {
      isAutoSaving.value = false
    }
  }

  function startAutoSave() {
    if (debouncedSave) {
      debouncedSave()
    }
  }

  function stopAutoSave() {
    if (debouncedSave) {
      debouncedSave = null
    }
  }

  watch(
    () => tabsStore.activeTab?.isDirty,
    (isDirty) => {
      if (isDirty && prefsStore.autoSave && debouncedSave) {
        debouncedSave()
      }
    }
  )

  watch(
    () => prefsStore.autoSave,
    (enabled) => {
      if (enabled) {
        setupAutoSave()
      } else {
        stopAutoSave()
      }
    }
  )

  watch(
    () => prefsStore.autoSaveDelay,
    () => {
      if (prefsStore.autoSave) {
        setupAutoSave()
      }
    }
  )

  onUnmounted(() => {
    stopAutoSave()
  })

  setupAutoSave()

  return {
    isAutoSaving,
    lastAutoSaveTime,
    autoSaveError,
    performAutoSave,
    startAutoSave,
    stopAutoSave
  }
}
