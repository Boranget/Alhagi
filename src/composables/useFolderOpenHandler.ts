import { onMounted, onUnmounted } from 'vue'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useLayoutStore } from '@/stores/layout'

export function useFolderOpenHandler() {
  const layoutStore = useLayoutStore()

  let unsubscribeFolderOpened: (() => void) | null = null

  function handleFolderOpened() {
    layoutStore.setSidebar(true)
    eventBus.emit(AppEvents.SIDEBAR_VIEW_CHANGED, 'files')
  }

  function setup() {
    unsubscribeFolderOpened = eventBus.on(AppEvents.FOLDER_OPENED, handleFolderOpened)
  }

  function cleanup() {
    if (unsubscribeFolderOpened) {
      unsubscribeFolderOpened()
      unsubscribeFolderOpened = null
    }
  }

  // 非组件上下文调用时，onMounted/onUnmounted 不会触发
  try {
    onMounted(setup)
    onUnmounted(cleanup)
  } catch {
    // 非组件上下文，直接 setup
    setup()
  }

  return {
    handleFolderOpened,
    setup,
    cleanup,
  }
}
