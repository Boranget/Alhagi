<template>
  <div
    class="app-container"
    :class="{ 'is-fullscreen': isFullscreen, 'is-sticky-note': prefsStore.isStickyNoteMode, 'is-immersive': prefsStore.isImmersiveMode }"
  >
    <div class="app-content">
      <div
        v-if="isWelcomePage"
        class="welcome-area"
      >
        <Welcome />
      </div>
      <div
        v-else
        class="main-area"
      >
        <EnhancedSidebar v-if="prefsStore.showSidebar" />
        <div class="editor-wrapper">
          <TabBar v-if="prefsStore.showTabBar" />
          <EditorContainer />
        </div>
      </div>
      <StatusBar v-if="prefsStore.showStatusBar && !isWelcomePage" />
    </div>
    <SettingsPanel
      :visible="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide, watch } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import TabBar from '@/components/Tabs/TabBar.vue'
import EnhancedSidebar from '@/components/Sidebar/EnhancedSidebar.vue'
import EditorContainer from '@/components/Editor/EditorContainer.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'
import SettingsPanel from '@/components/Settings/SettingsPanel.vue'
import Welcome from '@/components/Welcome/Welcome.vue'
import { useClipboard } from '@/services/clipboard'
import { useCapture } from '@/services/capture'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { eventBus, AppEvents } from '@/events/eventBus'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const showSettings = ref(false)
const isWelcomePage = ref(false)
const isFullscreen = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

provide('showSettings', showSettings)

const editorManager = useCrepeEditorManager()
provide('editorManager', editorManager)

const { initialize: initWritingEnhancement, cleanup: cleanupWritingEnhancement } = useWritingEnhancement()
const { copyAsMarkdown, copyAsHtml, pasteAsPlainText } = useClipboard()
const { captureEditor, copyCaptureToClipboard, downloadCapture } = useCapture()

useKeyboardShortcuts()

function triggerAutoSave() {
  if (!prefsStore.autoSave) return

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  autoSaveTimer = setTimeout(() => {
    const activeTab = tabsStore.activeTab
    if (activeTab && activeTab.isDirty && activeTab.filePath) {
      tabsStore.saveFile(activeTab.id)
    }
  }, prefsStore.autoSaveInterval * 1000)
}

function setupElectronListeners() {
  if (!window.electronAPI) return

  window.electronAPI.onNewFile(() => {
    tabsStore.createTab({ title: '未命名' })
  })

  window.electronAPI.onNewWindow(() => {
    if (window.electronAPI) {
      window.electronAPI.openNewWindow()
    }
  })

  window.electronAPI.onOpenFile(() => {
    tabsStore.openFile()
  })

  window.electronAPI.onSave(() => {
    if (tabsStore.activeTabId) {
      tabsStore.saveFile(tabsStore.activeTabId)
    }
  })

  window.electronAPI.onSaveAs(() => {
    if (tabsStore.activeTabId) {
      tabsStore.saveFileAs(tabsStore.activeTabId)
    }
  })

  window.electronAPI.onViewMode((mode: string) => {
    console.log('[App] View mode changed from menu:', mode)
    eventBus.emit(AppEvents.VIEW_MODE_CHANGED, mode)
  })

  window.electronAPI.onCopyAsMarkdown(() => {
    copyAsMarkdown()
  })

  window.electronAPI.onCopyAsHtml(() => {
    copyAsHtml()
  })

  window.electronAPI.onPasteAsPlain(() => {
    pasteAsPlainText()
  })

  window.electronAPI.onCaptureScreen(async () => {
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

  if (window.electronAPI.onTabMerge) {
    window.electronAPI.onTabMerge((tabData) => {
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
  }

  if (window.electronAPI?.onToggleStickyNoteMode) {
    window.electronAPI.onToggleStickyNoteMode(() => {
      prefsStore.toggleStickyNoteMode()
    })
  }

  if (window.electronAPI?.onToggleImmersiveMode) {
    window.electronAPI.onToggleImmersiveMode(() => {
      prefsStore.toggleImmersiveMode()
    })
  }

  if (window.electronAPI?.onToggleSidebar) {
    window.electronAPI.onToggleSidebar(() => {
      prefsStore.showSidebar = !prefsStore.showSidebar
    })
  }

  if (window.electronAPI?.onToggleTabBar) {
    window.electronAPI.onToggleTabBar(() => {
      prefsStore.showTabBar = !prefsStore.showTabBar
    })
  }

  if (window.electronAPI?.onToggleStatusBar) {
    window.electronAPI.onToggleStatusBar(() => {
      prefsStore.showStatusBar = !prefsStore.showStatusBar
    })
  }

  if (window.electronAPI?.onToggleTheme) {
    window.electronAPI.onToggleTheme(() => {
      prefsStore.toggleLightDark()
    })
  }

  if (window.electronAPI?.onOpenSettings) {
    window.electronAPI.onOpenSettings(() => {
      showSettings.value = true
    })
  }

  if (window.electronAPI?.onEditUndo) {
    window.electronAPI.onEditUndo(() => {
      console.log('[App] Undo requested')
    })
  }

  if (window.electronAPI?.onEditRedo) {
    window.electronAPI.onEditRedo(() => {
      console.log('[App] Redo requested')
    })
  }
}

function saveCurrentSession() {
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
    activeTabId: tabsStore.activeTabId ?? undefined
  })
}

watch(
  () => tabsStore.activeTab?.content,
  () => {
    if (prefsStore.autoSave && tabsStore.activeTab?.filePath) {
      triggerAutoSave()
    }
  }
)

watch(
  () => prefsStore.theme,
  async (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    prefsStore.applyTheme() // 确保正确应用主题
    await editorManager.updateTheme() // 更新编辑器主题
  }
)

// 监听系统主题变化
let systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null

function setupSystemThemeListener() {
  if (systemThemeListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeListener)
  }
  
  systemThemeListener = async (e: MediaQueryListEvent) => {
    if (prefsStore.theme === 'system') {
      console.log('[App] System theme changed:', e.matches ? 'dark' : 'light')
      prefsStore.applyTheme()
      await editorManager.updateTheme()
    }
  }
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemThemeListener)
}

watch(
  () => tabsStore.tabs.size,
  (newSize) => {
    if (newSize > 0 && isWelcomePage.value) {
      isWelcomePage.value = false
    } else if (newSize === 0 && !isWelcomePage.value) {
      isWelcomePage.value = true
    }
  }
)

onMounted(() => {
  setupElectronListeners()
  setupSystemThemeListener()
  window.addEventListener('beforeunload', saveCurrentSession)

  prefsStore.loadPreferences()
  console.log('[App] launchMode:', prefsStore.launchMode)
  initWritingEnhancement()

  const launchMode = prefsStore.launchMode

  console.log('[App] 启动模式:', launchMode)

  switch (launchMode) {
    case 'last-session': {
      const lastSession = prefsStore.getLastSession()
      if (lastSession) {
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
        isWelcomePage.value = false
      } else {
        isWelcomePage.value = true
      }
      break
    }

    case 'folder': {
      if (prefsStore.launchFolderPath && window.electronAPI) {
        window.electronAPI.openFolder().then((result: unknown) => {
          const folderResult = result as { success: boolean; data?: { path: string } }
          if (folderResult.success && folderResult.data) {
            import('@/services/fileService').then(({ useFileService }) => {
              const fileService = useFileService()
              fileService.openFolderByPath(folderResult.data!.path)
            })
          }
        })
      }
      isWelcomePage.value = false
      tabsStore.createTab({ title: '未命名' })
      break
    }

    case 'empty':
      isWelcomePage.value = false
      break

    case 'welcome':
    default:
      isWelcomePage.value = true
      break
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', saveCurrentSession)
  if (systemThemeListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeListener)
  }
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  saveCurrentSession()
  cleanupWritingEnhancement()
})
</script>

<style scoped lang="scss">
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);

  &.is-fullscreen {
    .main-area {
      height: calc(100vh - 36px);
    }
  }
}

.app-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.welcome-area {
  flex: 1;
  overflow: hidden;
}

.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  height: calc(100vh - 36px - 24px);
}

.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
