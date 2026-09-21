import type { CommandHandler } from '../types'
import { getDispatcher } from '../dispatcher'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useLayoutStore } from '@/stores/layout'
import { electronService } from '@/services/electron/ElectronService'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useWritingEnhancement } from '@/adapters/composables/useWritingEnhancement'

export function registerViewHandlers(dispatcher: ReturnType<typeof getDispatcher>): void {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const layoutStore = useLayoutStore()

  function changeMarkdownViewMode(mode: 'wysiwyg' | 'source' | 'split'): void {
    const tab = tabsStore.activeTab
    if (!tab || tab.fileType !== 'editor') return
    eventBus.emit(AppEvents.VIEW_MODE_CHANGE, { mode })
  }

  const handlers: Record<string, CommandHandler> = {
    'view.toggleSidebar': () => {
      layoutStore.toggleSidebar()
    },

    'view.toggleTabBar': () => {
      layoutStore.toggleTabBar()
    },

    'view.toggleStatusBar': () => {
      layoutStore.toggleStatusBar()
    },

    'view.toggleSourceMode': () => {
      const currentMode = tabsStore.activeTab?.viewMode
      changeMarkdownViewMode(currentMode === 'source' ? 'wysiwyg' : 'source')
    },

    'view.wysiwygMode': () => {
      changeMarkdownViewMode('wysiwyg')
    },

    'view.splitMode': () => {
      changeMarkdownViewMode('split')
    },

    'view.toggleTheme': () => {
      prefsStore.toggleLightDark()
    },

    'view.zoomIn': () => {
      prefsStore.zoomIn()
    },

    'view.zoomOut': () => {
      prefsStore.zoomOut()
    },

    'view.resetZoom': () => {
      prefsStore.resetZoom()
    },

    'view.fullscreen': () => {
      const api = electronService.getAPI()
      if (api) {
        api.executeMainCommand('view.fullscreen')
      } else if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
    },

    'view.devTools': () => {
      electronService.getAPI()?.executeMainCommand('view.devTools')
    },

    'view.stickyNoteMode': () => {
      const next = layoutStore.isStickyNoteMode ? 'normal' : 'sticky'
      electronService.getAPI()?.setWindowMode(next)
    },

    'view.immersiveMode': () => {
      const next = layoutStore.isImmersiveMode ? 'normal' : 'immersive'
      electronService.getAPI()?.setWindowMode(next)
    },

    'view.focusMode': () => {
      const { toggleFocusMode } = useWritingEnhancement()
      toggleFocusMode()
    },

    'view.typewriterMode': () => {
      const { toggleTypewriterMode } = useWritingEnhancement()
      toggleTypewriterMode()
    },

    'view.nextTab': () => {
      const tabOrder = tabsStore.tabOrder
      if (tabOrder.length > 0 && tabsStore.activeTabId) {
        const currentIndex = tabOrder.indexOf(tabsStore.activeTabId)
        const nextIndex = (currentIndex + 1) % tabOrder.length
        tabsStore.switchTab(tabOrder[nextIndex])
      }
    },

    'view.prevTab': () => {
      const tabOrder = tabsStore.tabOrder
      if (tabOrder.length > 0 && tabsStore.activeTabId) {
        const currentIndex = tabOrder.indexOf(tabsStore.activeTabId)
        const prevIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length
        tabsStore.switchTab(tabOrder[prevIndex])
      }
    },
  }

  dispatcher.registerBatch(handlers)
}
