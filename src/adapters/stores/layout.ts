import type { ILayoutRepository } from '@core/domain/ports/repositories/ILayoutRepository'
import { useLayoutStore } from '@/stores/layout'

export function useLayoutRepository(): ILayoutRepository {
  const layoutStore = useLayoutStore()

  return {
    getShowSidebar: () => layoutStore.showSidebar,
    getShowTabBar: () => layoutStore.showTabBar,
    getShowStatusBar: () => layoutStore.showStatusBar,
    isStickyNoteMode: () => layoutStore.isStickyNoteMode,
    isImmersiveMode: () => layoutStore.isImmersiveMode,
  }
}
