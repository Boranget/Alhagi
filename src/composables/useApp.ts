import { onMounted, onUnmounted, ref, watch, provide, computed } from 'vue'
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
import { useClipboard } from '@/services/clipboard'
import { useCapture } from '@/services/capture'
import TabBar from '@/components/Tabs/TabBar.vue'
import EnhancedSidebar from '@/components/Sidebar/EnhancedSidebar.vue'
import EditorContainer from '@/components/Editor/EditorContainer.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'
import SettingsPanel from '@/components/Settings/SettingsPanel.vue'
import Welcome from '@/components/Welcome/Welcome.vue'

const showSettings = ref(false)
const isFullscreen = ref(false)
const autoSaveTimer: ReturnType<typeof setTimeout> | null = null

export function useApp() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const fileStore = useFileExplorerStore()
  const editorManager = useCrepeEditorManager()
  
  const { initialize: initWritingEnhancement, cleanup: cleanupWritingEnhancement } = useWritingEnhancement()
  const { copyAsMarkdown, copyAsHtml, pasteAsPlainText } = useClipboard()
  const { captureEditor, copyCaptureToClipboard, downloadCapture } = useCapture()
  
  useKeyboardShortcuts()
  useAutoSave()

  const setupEventListeners = () => {
    const unsubscribers: (() => void)[] = []

    unsubscribers.push(
      eventBus.on(AppEvents.OPEN_SETTINGS, () => {
        showSettings.value = true
      })
    )

    unsubscribers.push(
      eventBus.on(AppEvents.COPY_AS_MARKDOWN, () => {
        copyAsMarkdown()
      })
    )

    unsubscribers.push(
      eventBus.on(AppEvents.COPY_AS_HTML, () => {
        copyAsHtml()
      })
    )

    unsubscribers.push(
      eventBus.on(AppEvents.PASTE_AS_PLAIN, () => {
        pasteAsPlainText()
      })
    )

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

    // 监听 Electron 菜单事件
    if (window.electronAPI) {
      // 文件菜单
      unsubscribers.push(window.electronAPI.onNewFile(() => tabsStore.createTab({ title: '未命名' })))
      unsubscribers.push(window.electronAPI.onOpenFile(() => tabsStore.openFile()))
      unsubscribers.push(window.electronAPI.onOpenFolder(() => window.electronAPI?.openFolder()))
      unsubscribers.push(window.electronAPI.onSave(() => tabsStore.activeTabId && tabsStore.saveFile(tabsStore.activeTabId)))
      unsubscribers.push(window.electronAPI.onSaveAs(() => tabsStore.activeTabId && tabsStore.saveFileAs(tabsStore.activeTabId)))
      
      // 格式菜单
      unsubscribers.push(window.electronAPI.onFormatBold(() => editorManager.toggleBold()))
      unsubscribers.push(window.electronAPI.onFormatItalic(() => editorManager.toggleItalic()))
      unsubscribers.push(window.electronAPI.onFormatStrikethrough(() => editorManager.toggleStrikethrough()))
      unsubscribers.push(window.electronAPI.onFormatCode(() => editorManager.toggleInlineCode()))
      unsubscribers.push(window.electronAPI.onFormatLink(() => editorManager.toggleLink()))
      unsubscribers.push(window.electronAPI.onFormatHighlight(() => editorManager.toggleHighlight()))
      
      // 段落菜单
      unsubscribers.push(window.electronAPI.onParagraphHeading1(() => editorManager.toggleHeading(1)))
      unsubscribers.push(window.electronAPI.onParagraphHeading2(() => editorManager.toggleHeading(2)))
      unsubscribers.push(window.electronAPI.onParagraphHeading3(() => editorManager.toggleHeading(3)))
      unsubscribers.push(window.electronAPI.onParagraphParagraph(() => editorManager.toggleParagraph()))
      unsubscribers.push(window.electronAPI.onParagraphQuote(() => editorManager.toggleBlockQuote()))
      unsubscribers.push(window.electronAPI.onParagraphBulletList(() => editorManager.toggleBulletList()))
      unsubscribers.push(window.electronAPI.onParagraphOrderedList(() => editorManager.toggleOrderedList()))
      unsubscribers.push(window.electronAPI.onParagraphTaskList(() => editorManager.toggleTaskList()))
      unsubscribers.push(window.electronAPI.onParagraphCodeBlock(() => editorManager.toggleCodeFence()))
      unsubscribers.push(window.electronAPI.onParagraphMathBlock(() => editorManager.insertMathBlock()))
      unsubscribers.push(window.electronAPI.onParagraphHorizontalRule(() => editorManager.insertHorizontalRule()))
      
      // 表格菜单
      unsubscribers.push(window.electronAPI.onTableInsert(() => editorManager.insertTable()))
      unsubscribers.push(window.electronAPI.onTableInsertRowAbove(() => editorManager.insertTableRowAbove()))
      unsubscribers.push(window.electronAPI.onTableInsertRowBelow(() => editorManager.insertTableRowBelow()))
      unsubscribers.push(window.electronAPI.onTableInsertColumnLeft(() => editorManager.insertTableColumnLeft()))
      unsubscribers.push(window.electronAPI.onTableInsertColumnRight(() => editorManager.insertTableColumnRight()))
      unsubscribers.push(window.electronAPI.onTableDeleteRow(() => editorManager.deleteTableRow()))
      unsubscribers.push(window.electronAPI.onTableDeleteColumn(() => editorManager.deleteTableColumn()))
      
      // 导航菜单
      unsubscribers.push(window.electronAPI.onNavigationQuickOpen(() => window.dispatchEvent(new CustomEvent('app:quickOpen'))))
      unsubscribers.push(window.electronAPI.onNavigationGotoLine(() => window.dispatchEvent(new CustomEvent('editor:gotoLine'))))
      
      // 工具菜单
      unsubscribers.push(window.electronAPI.onToolsPreferences(() => { showSettings.value = true }))
      unsubscribers.push(window.electronAPI.onToolsExport(() => window.dispatchEvent(new CustomEvent('app:export'))))
      unsubscribers.push(window.electronAPI.onHelpShortcuts(() => window.dispatchEvent(new CustomEvent('app:showShortcuts'))))
      
      // 视图菜单
      unsubscribers.push(window.electronAPI.onToggleSidebar(() => { prefsStore.showSidebar = !prefsStore.showSidebar }))
      unsubscribers.push(window.electronAPI.onToggleTabBar(() => { prefsStore.showTabBar = !prefsStore.showTabBar }))
      unsubscribers.push(window.electronAPI.onToggleStatusBar(() => { prefsStore.showStatusBar = !prefsStore.showStatusBar }))
    }

    return unsubscribers
  }

  const setupThemeWatchers = () => {
    const stopThemeWatch = watch(
      () => prefsStore.theme,
      async (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        prefsStore.applyTheme()
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
