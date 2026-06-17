import { ref, watch, provide } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { useAutoSave } from '@/composables/useAutoSave'
import { useFolderOpenHandler } from '@/composables/useFolderOpenHandler'
import { initCommandSystem } from '@/commands'
import { electronService } from '@/services/electron/ElectronService'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useCapture } from '@/services/capture'
import { setupEditorTypography } from '@/services/typography/EditorTypographyService'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

// 模块级响应式状态：useApp() 调用方共享同一份 ref
const isFullscreen = ref(false)

// 启动期幂等 guard：initializeApp 只跑一次，多次调用返回同一个 cleanup
// （防止后续有别处 useApp().initializeApp() 重复注册事件总线监听器、命令系统等）
let bootCleanup: (() => void) | null = null

export function useApp() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const fileStore = useFileExplorerStore()
  const editorManager = useCrepeEditorManager()
  const { confirm } = useConfirmDialog()

  const { initialize: initWritingEnhancement, cleanup: cleanupWritingEnhancement } = useWritingEnhancement()
  const { captureEditor, copyCaptureToClipboard, downloadCapture } = useCapture()

  useAutoSave()
  // 打开文件夹成功后，自动切回侧边栏"文件资源管理器"页。
  // fileExplorerStore.openFolder/openFolderByPath 都统一 emit FOLDER_OPENED，
  // 这里集中监听，保证最近文件夹、欢迎页、命令面板等所有入口行为一致。
  useFolderOpenHandler()

  const setupEventListeners = () => {
    const unsubscribers: (() => void)[] = []

    // 设置面板已重构为独立 BrowserWindow（settings.html）。
    // 主窗各处（侧边栏齿轮、命令面板"打开设置"等）触发 OPEN_SETTINGS 时，
    // 通过 IPC 让主进程的 SettingsWindowManager 创建/聚焦设置窗。
    unsubscribers.push(
      eventBus.on(AppEvents.OPEN_SETTINGS, () => {
        if (window.electronAPI?.openSettings) {
          window.electronAPI.openSettings().catch(() => {
            // 静默失败：用户可以重试
          })
        }
      })
    )

    // 截图功能（dispatcher.tools.captureScreen 通过 eventBus 触发）
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

    // 视图模式切换：dispatcher.view.toggleSourceMode / view.wysiwygMode 通过 eventBus 触发
    unsubscribers.push(
      eventBus.on(AppEvents.VIEW_MODE_CHANGE, async ({ mode }) => {
        const activeTab = tabsStore.activeTabId ? tabsStore.getTab(tabsStore.activeTabId) : null
        if (activeTab) {
          await tabsStore.updateTab(activeTab.id, { viewMode: mode })
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

  const confirmCloseWindow = async () => {
    const dirtyTabs = tabsStore.dirtyTabs
    let allowClose = true

    if (dirtyTabs.length > 0) {
      const dirtyNames = dirtyTabs
        .slice(0, 3)
        .map(tab => `「${tab.title}」`)
        .join('、')
      const suffix = dirtyTabs.length > 3 ? ` 等 ${dirtyTabs.length} 个文件` : ''

      allowClose = await confirm({
        title: '未保存的更改',
        message: `${dirtyNames}${suffix} 有未保存的更改，确定要关闭窗口吗？`,
        confirmText: '关闭窗口',
        cancelText: '取消',
        danger: true,
      })
    }

    if (allowClose) saveCurrentSession()
    await window.electronAPI?.closeResponse(allowClose)
  }

  const saveCurrentSession = () => {
    const sessionTabs = tabsStore.getAllTabs().map(tab => ({
      title: tab.title,
      content: tab.content,
      filePath: tab.filePath,
      viewMode: tab.viewMode,
      splitRatio: tab.splitRatio,
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
        viewMode: tabData.viewMode as 'wysiwyg' | 'source' | 'split',
        splitRatio: tabData.splitRatio ?? 50,
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
    // 幂等保护：多个组件调 useApp().initializeApp() 不会重复注册 eventBus 监听 /
    // 命令系统 / 主题监听等副作用。返回首次创建的 cleanup 闭包。
    if (bootCleanup) return bootCleanup

    electronService.initialize()

    initCommandSystem()

    const { startListening, stopListening } = setupSystemThemeListener()
    const stopThemeWatch = setupThemeWatchers()
    const eventUnsubscribers = setupEventListeners()
    // 字体大小 / 行高 → CSS 变量同步：watchEffect 跟随 store 单例，仅装载一次。
    setupEditorTypography()

    window.addEventListener('beforeunload', saveCurrentSession)
    const stopCloseRequest = window.electronAPI?.onCloseRequest(confirmCloseWindow)

    await prefsStore.loadPreferences()
    // 主进程菜单是在窗口创建前就 install 的（语言锁定占位），但真正构建菜单
    // 是在窗口 ready 时按 currentLanguage 跑。loadPreferences 后才知道用户
    // 偏好的语言，触发主进程按当前语言重建所有窗口菜单（zh-CN/en 两套标签生效）。
    // 布局 checkbox（侧边栏/标签栏/状态栏）由 layoutStore 驱动，初始默认 true，
    // 与 buildMenuTemplate 默认 checked: true 一致——无需额外回灌。
    if (window.electronAPI) {
      void window.electronAPI.rebuildMenu(prefsStore.language as 'zh-CN' | 'en')
    }
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

    bootCleanup = () => {
      stopListening()
      stopThemeWatch()
      eventUnsubscribers.forEach(unsub => unsub())
      stopCloseRequest?.()
      window.removeEventListener('beforeunload', saveCurrentSession)
      cleanupWritingEnhancement()
      saveCurrentSession()
      bootCleanup = null
    }

    return bootCleanup
  }

  provide('editorManager', editorManager)

  return {
    isFullscreen,
    initializeApp
  }
}
