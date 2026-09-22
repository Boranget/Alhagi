import { storeToRefs } from 'pinia'
import { useLayoutStore } from '@/stores/layout'

export function useLayoutContext() {
  const store = useLayoutStore()
  const {
    showSidebar, showTabBar, showStatusBar,
    isStickyNoteMode, isImmersiveMode,
  } = storeToRefs(store)

  return {
    showSidebar,
    showTabBar,
    showStatusBar,
    isStickyNoteMode,
    isImmersiveMode,
    toggleSidebar: store.toggleSidebar,
    setSidebar: store.setSidebar,
    setTabBar: store.setTabBar,
    setStatusBar: store.setStatusBar,
    applyWindowMode: store.applyWindowMode,
    restoreDefaults: store.restoreDefaults,
  }
}

export type LayoutContext = ReturnType<typeof useLayoutContext>
