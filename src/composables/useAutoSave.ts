import { ref, watch, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus as defaultEventBus, AppEvents } from '@/events/eventBus'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { debounce } from '@/utils/helpers'
import { useTabService } from '@/services/tabService'

export function useAutoSave(bus?: IEventBus) {
  const eventBus = bus ?? defaultEventBus
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const tabService = useTabService()
  const isAutoSaving = ref(false)
  const lastAutoSaveTime = ref<number | null>(null)
  const autoSaveError = ref<string | null>(null)

  let debouncedSave: ReturnType<typeof debounce> | null = null
  const unsubscribers: (() => void)[] = []
  const stopWatchers: (() => void)[] = []

  function setupAutoSave() {
    if (!prefsStore.autoSave) return

    // interval 变更重建时丢弃旧挂起，防止新旧两个 timer 双触发
    debouncedSave?.cancel()
    debouncedSave = debounce(async () => {
      await performAutoSave()
    }, prefsStore.autoSaveInterval * 1000)
  }

  /**
   * 保存**全部** dirty 且有落盘路径的 tab，而非仅活动 tab。
   * 触发源与保存目标必须解耦：CONTENT_CHANGED 只在 tab 活动期发出，
   * 防抖窗口内切走后，旧的"只存活动 tab"写法会让原 tab 的 dirty
   * 永无触发源——自动保存对其永久失效，直到用户重新编辑它。
   */
  async function performAutoSave() {
    const pending = tabsStore.dirtyTabs.filter(tab => !!tab.filePath)
    if (pending.length === 0) return

    isAutoSaving.value = true
    autoSaveError.value = null

    let failed = false
    for (const tab of pending) {
      try {
        const success = await tabService.saveFile(tab.id)
        if (success) {
          lastAutoSaveTime.value = Date.now()
        } else {
          failed = true
        }
      } catch (e) {
        failed = true
        console.error('[useAutoSave] save failed for', tab.id, e)
      }
    }
    // 单文件失败不阻断其余；isDirty 保持 true，下一轮触发会重试
    if (failed) autoSaveError.value = 'Failed to auto-save'

    isAutoSaving.value = false
  }

  function handleContentChanged() {
    if (prefsStore.autoSave && debouncedSave) {
      debouncedSave()
    }
  }

  function stopAutoSave() {
    // 关闭自动保存时撤销挂起的那次，否则停用后仍会落盘一次
    debouncedSave?.cancel()
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
