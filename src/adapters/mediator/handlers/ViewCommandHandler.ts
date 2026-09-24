import { useTabsStore } from '@/stores/tabs'
import { useLayoutStore } from '@/stores/layout'
import { electronService } from '@/services/electron/ElectronService'
import { eventBus, AppEvents } from '@/events/eventBus'

export class ViewCommandHandler {
  private tabsStore = useTabsStore()
  private layoutStore = useLayoutStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }
    switch (type) {
      case 'view:toggleSourceMode': {
        const currentMode = this.tabsStore.activeTab?.viewMode
        this.changeMarkdownViewMode(currentMode === 'source' ? 'wysiwyg' : 'source')
        return
      }
      case 'view:wysiwygMode':
        this.changeMarkdownViewMode('wysiwyg')
        return
      case 'view:splitMode':
        this.changeMarkdownViewMode('split')
        return
      case 'view:fullscreen': {
        const api = electronService.getAPI()
        if (api) {
          api.executeMainCommand('view.fullscreen')
        } else if (document.fullscreenElement) {
          document.exitFullscreen()
        } else {
          document.documentElement.requestFullscreen()
        }
        return
      }
      case 'view:devTools':
        electronService.getAPI()?.executeMainCommand('view.devTools')
        return
      case 'view:stickyNoteMode': {
        const next = this.layoutStore.isStickyNoteMode ? 'normal' : 'sticky'
        electronService.getAPI()?.setWindowMode(next)
        return
      }
      case 'view:immersiveMode': {
        const next = this.layoutStore.isImmersiveMode ? 'normal' : 'immersive'
        electronService.getAPI()?.setWindowMode(next)
        return
      }
      case 'view:nextTab': {
        const tabOrder = this.tabsStore.tabOrder
        if (tabOrder.length > 0 && this.tabsStore.activeTabId) {
          const currentIndex = tabOrder.indexOf(this.tabsStore.activeTabId)
          const nextIndex = (currentIndex + 1) % tabOrder.length
          this.tabsStore.switchTab(tabOrder[nextIndex])
        }
        return
      }
      case 'view:prevTab': {
        const tabOrder = this.tabsStore.tabOrder
        if (tabOrder.length > 0 && this.tabsStore.activeTabId) {
          const currentIndex = tabOrder.indexOf(this.tabsStore.activeTabId)
          const prevIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length
          this.tabsStore.switchTab(tabOrder[prevIndex])
        }
        return
      }
      default:
        throw new Error(`Unknown view command: ${type}`)
    }
  }

  private changeMarkdownViewMode(mode: 'wysiwyg' | 'source' | 'split'): void {
    const tab = this.tabsStore.activeTab
    if (!tab || tab.fileType !== 'editor') return
    eventBus.emit(AppEvents.VIEW_MODE_CHANGE, { mode })
  }
}
