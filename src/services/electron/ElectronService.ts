import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { eventBus, AppEvents } from '@/events/eventBus'
import type { ElectronAPI } from 'electron-protocol'

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export class ElectronService {
  private static instance: ElectronService | null = null
  private api: ElectronAPI | undefined = undefined
  private initialized = false

  private constructor() {}

  static getInstance(): ElectronService {
    if (!ElectronService.instance) {
      ElectronService.instance = new ElectronService()
    }
    return ElectronService.instance
  }

  initialize(): void {
    if (this.initialized) return
    
    this.api = window.electronAPI
    if (!this.api) {
      console.warn('[ElectronService] Electron API not available')
      return
    }

    this.setupEventListeners()
    this.initialized = true
    console.log('[ElectronService] Initialized')
  }

  getAPI(): ElectronAPI | undefined {
    return this.api
  }

  isAvailable(): boolean {
    return !!this.api
  }

  private setupEventListeners(): void {
    if (!this.api) return

    const tabsStore = useTabsStore()
    const prefsStore = usePreferencesStore()

    this.api.onNewFile(() => {
      tabsStore.createTab({ title: '未命名' })
    })

    this.api.onNewWindow(() => {
      if (this.api) {
        this.api.openNewWindow()
      }
    })

    this.api.onOpenFile(() => {
      tabsStore.openFile()
    })

    this.api.onOpenFolder(() => {
      this.handleOpenFolder()
    })

    this.api.onSave(() => {
      if (tabsStore.activeTabId) {
        tabsStore.saveFile(tabsStore.activeTabId)
      }
    })

    this.api.onSaveAs(() => {
      if (tabsStore.activeTabId) {
        tabsStore.saveFileAs(tabsStore.activeTabId)
      }
    })

    this.api.onViewMode((mode: string) => {
      eventBus.emit(AppEvents.VIEW_MODE_CHANGED, mode as 'wysiwyg' | 'source' | 'split')
    })

    this.api.onCopyAsMarkdown(() => {
      eventBus.emit(AppEvents.COPY_AS_MARKDOWN)
    })

    this.api.onCopyAsHtml(() => {
      eventBus.emit(AppEvents.COPY_AS_HTML)
    })

    this.api.onPasteAsPlain(() => {
      eventBus.emit(AppEvents.PASTE_AS_PLAIN)
    })

    this.api.onCaptureScreen(() => {
      eventBus.emit(AppEvents.CAPTURE_SCREEN)
    })

    this.api.onTabMerge?.((tabData) => {
      this.createTabFromDetachedData(tabData)
    })

    this.api.onTabDetached?.((tabData) => {
      this.createTabFromDetachedData(tabData)
    })

    this.api.onFocusTabForFile?.((filePath) => {
      const existingTab = Array.from(tabsStore.tabs.values()).find(
        t => t.filePath === filePath
      )
      if (existingTab) {
        tabsStore.switchTab(existingTab.id)
      }
    })

    this.api.onToggleStickyNoteMode?.(() => {
      prefsStore.toggleStickyNoteMode()
    })

    this.api.onToggleImmersiveMode?.(() => {
      prefsStore.toggleImmersiveMode()
    })

    this.api.onToggleSidebar?.(() => {
      prefsStore.showSidebar = !prefsStore.showSidebar
    })

    this.api.onToggleTabBar?.(() => {
      prefsStore.showTabBar = !prefsStore.showTabBar
    })

    this.api.onToggleStatusBar?.(() => {
      prefsStore.showStatusBar = !prefsStore.showStatusBar
    })

    this.api.onToggleTheme?.(() => {
      prefsStore.toggleLightDark()
    })

    this.api.onZoomIn?.(() => {
      prefsStore.zoomIn()
    })

    this.api.onZoomOut?.(() => {
      prefsStore.zoomOut()
    })

    this.api.onZoomReset?.(() => {
      prefsStore.resetZoom()
    })

    this.api.onOpenSettings?.(() => {
      eventBus.emit(AppEvents.OPEN_SETTINGS)
    })

    this.api.onEditUndo?.(() => {
      eventBus.emit(AppEvents.EDIT_UNDO)
    })

    this.api.onEditRedo?.(() => {
      eventBus.emit(AppEvents.EDIT_REDO)
    })
  }

  private async handleOpenFolder(): Promise<void> {
    if (!this.api) return

    const result = await this.api.openFolder()
    if (result.success && result.data) {
      const fileStore = useFileExplorerStore()
      await fileStore.openFolderByPath(result.data.path)
    }
  }

  private createTabFromDetachedData(tabData: {
    id: string
    title: string
    content: string
    filePath: string | null
    isDirty: boolean
    viewMode: string
    cursor: { from: number; to: number }
    scrollTop?: number
  }): void {
    const tabsStore = useTabsStore()
    const tab = tabsStore.createTab({
      title: tabData.title,
      content: tabData.content,
      filePath: tabData.filePath ?? undefined,
      viewMode: tabData.viewMode as 'wysiwyg' | 'source' | 'split'
    })
    if (tabData.isDirty) {
      tabsStore.updateTab(tab.id, { isDirty: true })
    }
    if (tabData.scrollTop !== undefined) {
      tabsStore.updateTab(tab.id, { scrollTop: tabData.scrollTop })
    }
  }

  async syncOpenedFiles(): Promise<void> {
    if (!this.api) return
    const tabsStore = useTabsStore()
    const filePaths = Array.from(tabsStore.tabs.values())
      .map(tab => tab.filePath)
      .filter((filePath): filePath is string => filePath !== null)
    await this.api.updateOpenedFiles(filePaths)
  }

  openDevTools(): void {
    if (this.api) {
      this.api.openDevTools()
    }
  }
}

export const electronService = ElectronService.getInstance()
