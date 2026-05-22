<template>
  <div
    class="app-container"
    :class="{ 'is-fullscreen': isFullscreen, 'is-sticky-note': prefsStore.isStickyNoteMode, 'is-immersive': prefsStore.isImmersiveMode }"
  >
    <div class="app-content">
      <EnhancedSidebar v-if="prefsStore.showSidebar" />
      <div class="editor-wrapper">
        <TabBar v-if="prefsStore.showTabBar && tabsStore.tabs.size > 0" />
        <div class="editor-area">
          <EditorContainer v-if="tabsStore.tabs.size > 0" />
          <Welcome v-else />
        </div>
      </div>
    </div>
    <StatusBar v-if="prefsStore.showStatusBar" />
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
import { useFileExplorerStore } from '@/stores/fileExplorer'
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
const fileStore = useFileExplorerStore()
const showSettings = ref(false)
const isFullscreen = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

provide('showSettings', showSettings)

const editorManager = useCrepeEditorManager()
provide('editorManager', editorManager)

const { initialize: initWritingEnhancement, cleanup: cleanupWritingEnhancement } = useWritingEnhancement()
const { copyAsMarkdown, copyAsHtml, pasteAsPlainText } = useClipboard()
const { captureEditor, copyCaptureToClipboard, downloadCapture } = useCapture()

useKeyboardShortcuts()

function createTabFromDetachedData(tabData: { id: string; title: string; content: string; filePath: string | null; isDirty: boolean; viewMode: string; cursor: { from: number; to: number }; scrollTop?: number }) {
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
  return tab
}

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

async function openFolderFromMenu() {
    if (!window.electronAPI) {
      return
    }
    
    const result = await window.electronAPI.openFolder()
    if (result.success && result.data) {
      await fileStore.openFolderByPath(result.data.path)
    }
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

    window.electronAPI.onOpenFolder(() => {
      openFolderFromMenu()
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
    eventBus.emit(AppEvents.VIEW_MODE_CHANGED, mode as 'wysiwyg' | 'source' | 'split')
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
      createTabFromDetachedData(tabData)
    })
  }

  if (window.electronAPI.onTabDetached) {
    window.electronAPI.onTabDetached((tabData) => {
      createTabFromDetachedData(tabData)
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
      // Undo handled by editor
    })
  }

  if (window.electronAPI?.onEditRedo) {
    window.electronAPI.onEditRedo(() => {
      // Redo handled by editor
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
      prefsStore.applyTheme()
      await editorManager.updateTheme()
    }
  }
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemThemeListener)
}



onMounted(() => {
  setupElectronListeners()
  setupSystemThemeListener()
  window.addEventListener('beforeunload', saveCurrentSession)

  prefsStore.loadPreferences()
  initWritingEnhancement()

  const launchMode = prefsStore.launchMode

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
      }
      break
    }

    case 'folder': {
      if (prefsStore.launchFolderPath && window.electronAPI) {
        window.electronAPI.openFolder().then((result: unknown) => {
          const folderResult = result as { success: boolean; data?: { path: string } }
          if (folderResult.success && folderResult.data) {
            fileStore.openFolderByPath(folderResult.data!.path)
          }
        })
      }
      tabsStore.createTab({ title: '未命名' })
      break
    }

    case 'empty':
    case 'welcome':
    default:
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
  min-height: 0;
}

.app-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.editor-area {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
