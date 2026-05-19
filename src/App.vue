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
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import TabBar from '@/components/Tabs/TabBar.vue'
import EnhancedSidebar from '@/components/Sidebar/EnhancedSidebar.vue'
import EditorContainer from '@/components/Editor/EditorContainer.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'
import SettingsPanel from '@/components/Settings/SettingsPanel.vue'
import Welcome from '@/components/Welcome/Welcome.vue'
import { useClipboard } from '@/services/clipboard'
import { useCapture } from '@/services/capture'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const showSidebar = ref(true)
const isFullscreen = ref(false)
const showSettings = ref(false)
const isWelcomePage = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

provide('showSidebar', showSidebar)
provide('isFullscreen', isFullscreen)
provide('showSettings', showSettings)

// 创建共享的 CrepeEditorManager 实例
const editorManager = useCrepeEditorManager()
provide('editorManager', editorManager)

const { toggleTypewriterMode, toggleFocusMode, initialize: initWritingEnhancement } = useWritingEnhancement()
const { copyAsMarkdown, copyAsHtml, pasteAsPlainText } = useClipboard()
const { captureEditor, copyCaptureToClipboard, downloadCapture } = useCapture()

const writingEnhancementCleanup = ref<(() => void) | null>(null)

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

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'F11') {
    e.preventDefault()
    isFullscreen.value = !isFullscreen.value
    return
  }

  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault()
        if (e.shiftKey) {
          tabsStore.saveFileAs(tabsStore.activeTabId!)
        } else {
          tabsStore.saveFile(tabsStore.activeTabId!)
        }
        break
      case 'n':
        e.preventDefault()
        if (e.shiftKey) {
          if (window.electronAPI) {
            window.electronAPI.openFolder().then((result: any) => {
              if (result.success && result.data) {
                // 使用 fileService 打开文件夹
                import('@/services/fileService').then(({ useFileService }) => {
                  const fileService = useFileService()
                  fileService.openFolderByPath(result.data.path)
                })
              }
            })
          }
        } else {
          tabsStore.createTab({ title: '未命名' })
        }
        break
      case 'o':
        e.preventDefault()
        if (e.shiftKey) {
          tabsStore.openFile()
        } else {
          if (window.electronAPI) {
            window.electronAPI.openFile().then((result: any) => {
              if (result.success && result.data) {
                const { filePath, content } = result.data
                const title = filePath.split('/').pop()?.split('\\').pop() || '未命名'
                tabsStore.createTab({
                  title,
                  content,
                  filePath
                })
                import('@/stores/preferences').then(({ usePreferencesStore }) => {
                  const prefsStore = usePreferencesStore()
                  prefsStore.addRecentFile(filePath, title)
                })
              }
            })
          }
        }
        break
      case 'b':
        e.preventDefault()
        showSidebar.value = !showSidebar.value
        break
      case ',':
        e.preventDefault()
        showSettings.value = true
        break
      case 'w':
        e.preventDefault()
        if (e.shiftKey) {
          if (tabsStore.activeTabId) {
            const tab = tabsStore.tabs.get(tabsStore.activeTabId)
            if (tab?.isDirty) {
              if (confirm('文件有未保存的更改，确定要关闭吗？')) {
                tabsStore.removeTab(tabsStore.activeTabId)
              }
            } else {
              tabsStore.removeTab(tabsStore.activeTabId)
            }
          }
        } else {
          if (tabsStore.activeTabId) {
            tabsStore.removeTab(tabsStore.activeTabId)
          }
        }
        break
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9': {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (index >= 0 && index < tabsStore.tabOrder.length) {
          tabsStore.switchTab(tabsStore.tabOrder[index])
        }
        break
      }
      case 'tab':
        e.preventDefault()
        if (tabsStore.tabOrder.length > 0) {
          const currentIndex = tabsStore.tabOrder.indexOf(tabsStore.activeTabId!)
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabsStore.tabOrder.length) % tabsStore.tabOrder.length
            : (currentIndex + 1) % tabsStore.tabOrder.length
          tabsStore.switchTab(tabsStore.tabOrder[nextIndex])
        }
        break
      case 'p':
        if (e.shiftKey) {
          e.preventDefault()
          toggleFocusMode()
        }
        break
      case 't':
        if (e.shiftKey) {
          e.preventDefault()
          toggleTypewriterMode()
        }
        break
      case 'e':
        if (e.shiftKey) {
          e.preventDefault()
          showExportDialog()
        }
        break
    }
  }
}

function showExportDialog() {
  const activeTab = tabsStore.activeTab
  if (!activeTab) return

  const exportOptions = [
    { label: 'Markdown (.md)', value: 'md' },
    { label: 'HTML (.html)', value: 'html' },
    { label: 'Plain Text (.txt)', value: 'txt' }
  ]

  const selectedOption = prompt(
    '选择导出格式：\n' + exportOptions.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n'),
    '1'
  )

  if (!selectedOption) return

  const optionIndex = parseInt(selectedOption) - 1
  if (optionIndex >= 0 && optionIndex < exportOptions.length) {
    const option = exportOptions[optionIndex]
    exportFile(activeTab.content, activeTab.title, option.value as 'md' | 'html' | 'txt')
  }
}

function exportFile(content: string, title: string, format: 'md' | 'html' | 'txt') {
  let exportContent = content
  let mimeType = 'text/markdown'
  let extension = '.md'

  if (format === 'html') {
    exportContent = getFullHtml(title)
    mimeType = 'text/html'
    extension = '.html'
  } else if (format === 'txt') {
    exportContent = content
    mimeType = 'text/plain'
    extension = '.txt'
  }

  const blob = new Blob([exportContent], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  const baseName = title.replace(/\.md$/, '')
  a.href = url
  a.download = `${baseName}${extension}`
  a.click()

  URL.revokeObjectURL(url)
}

function getFullHtml(title: string): string {
  const content = editorManager.getHTML()
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
    pre { background: #f4f4f4; padding: 16px; overflow-x: auto; border-radius: 4px; }
    img { max-width: 100%; }
    a { color: #0066cc; }
  </style>
</head>
<body>
${content}
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function setupElectronListeners() {
  if (!window.electronAPI) return

  window.electronAPI.onNewFile(() => {
    tabsStore.createTab({ title: '未命名' })
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

  window.electronAPI.onViewMode((mode) => {
    editorManager.setViewMode(mode as 'wysiwyg' | 'source' | 'split')
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
  
  // 监听标签页合并事件
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
  
  // 监听切换悬浮便签模式事件
  if (window.electronAPI?.onToggleStickyNoteMode) {
    window.electronAPI.onToggleStickyNoteMode(() => {
      prefsStore.toggleStickyNoteMode()
    })
  }
  
  // 监听切换沉浸式模式事件
  if (window.electronAPI?.onToggleImmersiveMode) {
    window.electronAPI.onToggleImmersiveMode(() => {
      prefsStore.toggleImmersiveMode()
    })
  }
  
  // 监听切换侧边栏事件
  if (window.electronAPI?.onToggleSidebar) {
    window.electronAPI.onToggleSidebar(() => {
      prefsStore.showSidebar = !prefsStore.showSidebar
    })
  }
  
  // 监听打开设置事件
  if (window.electronAPI?.onOpenSettings) {
    window.electronAPI.onOpenSettings(() => {
      showSettings.value = true
    })
  }
  
  // 监听编辑菜单的撤销/重做事件
  if (window.electronAPI?.onEditUndo) {
    window.electronAPI.onEditUndo(() => {
      // Crepe 编辑器已经内置了撤销/重做功能
      // 可以通过键盘快捷键或编辑器内部实现
      console.log('[App] Undo requested')
    })
  }
  
  if (window.electronAPI?.onEditRedo) {
    window.electronAPI.onEditRedo(() => {
      // Crepe 编辑器已经内置了撤销/重做功能
      console.log('[App] Redo requested')
    })
  }
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
  () => prefsStore.showSidebar,
  (value) => {
    showSidebar.value = value
  }
)

watch(
  () => prefsStore.theme,
  (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
  }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  setupElectronListeners()
  window.addEventListener('beforeunload', saveCurrentSession)

  prefsStore.loadPreferences()
  console.log('[App] launchMode:', prefsStore.launchMode)
  initWritingEnhancement()
  
  const launchMode = prefsStore.launchMode
  
  console.log('[App] 启动模式:', launchMode)
  
  switch (launchMode) {
    case 'last-session':
      const lastSession = prefsStore.getLastSession()
      if (lastSession) {
        // 恢复上次会话
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
          // 恢复文件夹（需要fileService）
        }
        isWelcomePage.value = false
      } else {
        // 没有保存的会话，显示欢迎页
        isWelcomePage.value = true
      }
      break
      
    case 'folder':
      if (prefsStore.launchFolderPath && window.electronAPI) {
        window.electronAPI.openFolder().then((result: any) => {
          if (result.success && result.data) {
            // 使用 fileService 打开文件夹
            import('@/services/fileService').then(({ useFileService }) => {
              const fileService = useFileService()
              fileService.openFolderByPath(result.data.path)
            })
          }
        })
      }
      isWelcomePage.value = false
      tabsStore.createTab({ title: '未命名' })
      break
      
    case 'empty':
      // 保持空白，不创建标签，不显示欢迎页
      isWelcomePage.value = false
      break
      
    case 'welcome':
    default:
      // 默认显示欢迎页
      isWelcomePage.value = true
      break
  }
})

// 监听标签页数量变化，从欢迎页切换到编辑器，或从编辑器切换到欢迎页
watch(
  () => tabsStore.tabs.size,
  (newSize) => {
    if (newSize > 0 && isWelcomePage.value) {
      // 有标签页时，隐藏欢迎页
      isWelcomePage.value = false
    } else if (newSize === 0 && !isWelcomePage.value) {
      // 没有标签页时，显示欢迎页
      isWelcomePage.value = true
    }
  }
)

// 保存会话
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

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('beforeunload', saveCurrentSession)
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  // 保存最后会话
  saveCurrentSession()
  
  // 清理写作增强功能
  const { cleanup: cleanupWritingEnhancement } = useWritingEnhancement()
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
