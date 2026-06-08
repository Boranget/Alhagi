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

  // 通过事件总线监听内容变化而不是直接 watch
  function handleContentChanged() {
    if (prefsStore.autoSave && debouncedSave) {
      debouncedSave()
    }
  }

  function stopAutoSave() {
    debouncedSave = null
  }

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
    () => prefsStore.autoSaveInterval,
    () => {
      if (prefsStore.autoSave) {
        setupAutoSave()
      }
    }
  )

  // 监听事件总线
  onUnmounted(() => {
    stopAutoSave()
    unsubscribers.forEach(unsub => unsub())
  })

  setupAutoSave()

  // 订阅内容变化事件
  const unsubscribeContent = eventBus.on(AppEvents.CONTENT_CHANGED, handleContentChanged)
  unsubscribers.push(unsubscribeContent)

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
    stopAutoSave
  }
}
