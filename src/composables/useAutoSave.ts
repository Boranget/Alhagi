import { ref, watch, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { debounce } from '@/utils/helpers'
import { useTabService } from '@/services/tabService'

export function useAutoSave() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const tabService = useTabService()
  const isAutoSaving = ref(false)
  const lastAutoSaveTime = ref<number | null>(null)
  const autoSaveError = ref<string | null>(null)

  let debouncedSave: (() => void) | null = null
  const unsubscribers: (() => void)[] = []
  const stopWatchers: (() => void)[] = []

  function setupAutoSave() {
    if (!prefsStore.autoSave) return

    debouncedSave = debounce(async () => {
      await performAutoSave()
    }, prefsStore.autoSaveInterval * 1000)
  }

  async function performAutoSave() {
    const activeTab = tabsStore.activeTab

    if (!activeTab || !activeTab.isDirty || !activeTab.filePath) {
      return
    }

    isAutoSaving.value = true
    autoSaveError.value = null

    try {
      const success = await tabService.saveFile(activeTab.id)
      if (success) {
        lastAutoSaveTime.value = Date.now()
      } else {
        autoSaveError.value = 'Failed to auto-save'
      }
    } catch (e) {
      autoSaveError.value = `Auto-save error: ${e}`
    } finally {
      isAutoSaving.value = false
    }
  }

  function handleContentChanged() {
    if (prefsStore.autoSave && debouncedSave) {
      debouncedSave()
    }
  }

  function stopAutoSave() {
    debouncedSave = null
  }

  function cleanup() {
    stopAutoSave()
    unsubscribers.forEach(unsub => unsub())
    unsubscribers.length = 0
    stopWatchers.forEach(stop => stop())
    stopWatchers.length = 0
  }

  const stopAutoSaveWatch = watch(
    () => prefsStore.autoSave,
    (enabled) => {
      if (enabled) {
        setupAutoSave()
      } else {
        stopAutoSave()
      }
    }
  )
  stopWatchers.push(stopAutoSaveWatch)

  const stopIntervalWatch = watch(
    () => prefsStore.autoSaveInterval,
    () => {
      if (prefsStore.autoSave) {
        setupAutoSave()
      }
    }
  )
  stopWatchers.push(stopIntervalWatch)

  setupAutoSave()

  const unsubscribeContent = eventBus.on(AppEvents.CONTENT_CHANGED, handleContentChanged)
  unsubscribers.push(unsubscribeContent)

  // 非组件上下文调用时，onUnmounted 不会触发，改用显式 cleanup
  try {
    onUnmounted(cleanup)
  } catch {
    // 非组件上下文，忽略
  }

  return {
    isAutoSaving,
    lastAutoSaveTime,
    autoSaveError,
    performAutoSave,
    startAutoSave: () => {
      if (debouncedSave) {
        debouncedSave()
      }
    },
    stopAutoSave,
    cleanup,
  }
}
