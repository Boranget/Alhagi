import { ref, watch, provide } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { useAutoSave } from '@/composables/useAutoSave'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { initCommandSystem } from '@/commands'
import { electronService } from '@/services/electron/ElectronService'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useCapture } from '@/services/capture'

const showSettings = ref(false)
const isFullscreen = ref(false)
const autoSaveTimer: ReturnType<typeof setTimeout> | null = null

export function useApp() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const fileStore = useFileExplorerStore()
  const editorManager = useCrepeEditorManager()
  
  const { initialize: initWritingEnhancement, cleanup: cleanupWritingEnhancement } = useWritingEnhancement()
  const { captureEditor, copyCaptureToClipboard, downloadCapture } = useCapture()
  
  useKeyboardShortcuts()
  useAutoSave()

  const setupEventListeners = () => {
    const unsubscribers: (() => void)[] = []

    // 应用内部事件监听
    unsubscribers.push(
      eventBus.on(AppEvents.OPEN_SETTINGS, () => {
        showSettings.value = true
      })
    )

    // 截图功能（使用应用内部事件总线，由 ElectronEventHandler 转发）
    unsubscribers.push(
      eventBus.on(AppEvents.CAPTURE_SCREEN, async () => {
        const result = await captureEditor()
        if (result) {
          const action = prompt('截图完成！选择操作：\n1. 复制到剪贴板\n2. 下载到本地\n3. 取消', '1')
          if (action === '1') {
            await copyCaptureToClipboard(result)
            alert('已复制到剪贴板')
          } else if (action === '2') {
            const filename = `screenshot-${Date.now()}.png`
            downloadCapture(result, filename)
          }
        }
      })
    )

    // 新窗口请求
    unsubscribers.push(
      eventBus.on(AppEvents.NEW_WINDOW_REQUESTED, () => {
        electronService.openNewWindow()
      })
    )

    // 视图模式切换
    unsubscribers.push(
      eventBus.on(AppEvents.VIEW_MODE_CHANGE, async (mode) => {
        const activeTab = tabsStore.activeTabId ? tabsStore.getTab(tabsStore.activeTabId) : null
        if (activeTab) {
          await tabsStore.updateTab(activeTab.id, { viewMode: mode as 'wysiwyg' | 'source' | 'split' })
        }
      })
    )

    // 光标变化事件 - 保存光标位置到 tab state
    unsubscribers.push(
      eventBus.on(AppEvents.CURSOR_CHANGED, ({ from, to, tabId }) => {
        if (tabId) {
          tabsStore.updateTab(tabId, {
            cursor: { from, to }
          })
        }
      })
    )

    // 滚动事件 - 保存滚动位置到 tab state
    unsubscribers.push(
      eventBus.on(AppEvents.SCROLL_CHANGED, ({ scrollTop, tabId }) => {
        if (tabId) {
          tabsStore.updateTab(tabId, { scrollTop })
        }
      })
    )

    // 标签页切换事件 - 先保存当前状态，再恢复新标签的状态
    unsubscribers.push(
      eventBus.on(AppEvents.TAB_SWITCHED, async ({ tabId }) => {
        if (!tabId) return

        console.log(`[App] TAB_SWITCHED 事件: ${tabId}`)
        // 状态保存和恢复已经在 switchToTab 中处理，这里只做其他需要响应切换的逻辑
      })
    )

    // 悬浮便签模式切换
    unsubscribers.push(
      eventBus.on(AppEvents.TOGGLE_STICKY_NOTE_MODE, () => {
        prefsStore.toggleStickyNoteMode()
      })
    )

    // 沉浸式模式切换
    unsubscribers.push(
      eventBus.on(AppEvents.TOGGLE_IMMERSIVE_MODE, () => {
        prefsStore.toggleImmersiveMode()
      })
    )

    // 注意：所有 Electron 菜单事件现在由 ElectronEventHandler 统一管理
    // 不再在这里重复注册，避免重复监听

    return unsubscribers
  }

  const setupThemeWatchers = () => {
    const stopThemeWatch = watch(
      () => prefsStore.theme,
      async () => {
        await editorManager.updateTheme()
      }
    )

    return stopThemeWatch
  }

  const setupSystemThemeListener = () => {
    let systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null

    const startListening = () => {
      if (systemThemeListener) {
        return
      }

      systemThemeListener = async (_e: MediaQueryListEvent) => {
        if (prefsStore.theme === 'system') {
          prefsStore.applyTheme()
          await editorManager.updateTheme()
        }
      }

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemThemeListener)
    }

    const stopListening = () => {
      if (systemThemeListener) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeListener)
        systemThemeListener = null
      }
    }

    return { startListening, stopListening }
  }

  const saveCurrentSession = () => {
    const sessionTabs = tabsStore.getAllTabs().map(tab => ({
      title: tab.title,
      content: tab.content,
      filePath: tab.filePath,
      viewMode: tab.viewMode,
      isDirty: tab.isDirty,
      cursor: { from: 0, to: 0 }
    }))

    prefsStore.saveSession({
      tabs: sessionTabs,
      activeTabId: tabsStore.activeTabId ?? undefined,
      currentFolder: fileStore.currentFolder ?? undefined
    })
  }

  const restoreLastSession = (lastSession: NonNullable<ReturnType<typeof prefsStore.getLastSession>>) => {
    lastSession.tabs.forEach((tabData) => {
      const tab = tabsStore.createTab({
        title: tabData.title,
        content: tabData.content,
        filePath: tabData.filePath ?? undefined,
        viewMode: tabData.viewMode as 'wysiwyg' | 'source' | 'split'
      })
      if (tabData.isDirty) {
        tabsStore.updateTab(tab.id, { isDirty: true })
      }
    })
    if (lastSession.activeTabId) {
      tabsStore.switchTab(lastSession.activeTabId)
    }
    if (lastSession.currentFolder) {
      fileStore.openFolderByPath(lastSession.currentFolder)
    }
  }

  const initializeApp = async () => {
    electronService.initialize()
    
    initCommandSystem()
    
    const { startListening, stopListening } = setupSystemThemeListener()
    const stopThemeWatch = setupThemeWatchers()
    const eventUnsubscribers = setupEventListeners()

    window.addEventListener('beforeunload', saveCurrentSession)

    prefsStore.loadPreferences()
    initWritingEnhancement()
    startListening()

    if (prefsStore.devToolsOnStartup && window.electronAPI) {
      electronService.openDevTools()
    }

    const launchMode = prefsStore.launchMode

    switch (launchMode) {
      case 'last-session': {
        const lastSession = prefsStore.getLastSession()
        if (lastSession) {
          restoreLastSession(lastSession)
        }
        break
      }

      case 'folder': {
        if (prefsStore.launchFolderPath && window.electronAPI) {
          const result = await window.electronAPI.openFolder()
          if (result.success && result.data) {
            fileStore.openFolderByPath(result.data.path)
          }
        }
        tabsStore.createTab({ title: '未命名' })
        break
      }

      case 'empty':
      case 'welcome':
      default:
        break
    }

    return () => {
      stopListening()
      stopThemeWatch()
      eventUnsubscribers.forEach(unsub => unsub())
      window.removeEventListener('beforeunload', saveCurrentSession)
      cleanupWritingEnhancement()
      
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
      }
      
      saveCurrentSession()
    }
  }

  provide('showSettings', showSettings)
  provide('editorManager', editorManager)

  return {
    showSettings,
    isFullscreen,
    initializeApp
  }
}
