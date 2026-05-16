<template>
  <div
    class="app-container"
    :class="{ 'is-fullscreen': isFullscreen }"
  >
    <div class="app-content">
      <TabBar />
      <div class="main-area">
        <EnhancedSidebar v-if="showSidebar" />
        <EditorContainer />
      </div>
      <StatusBar v-if="prefsStore.showStatusBar" />
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
import TabBar from '@/components/Tabs/TabBar.vue'
import EnhancedSidebar from '@/components/Sidebar/EnhancedSidebar.vue'
import EditorContainer from '@/components/Editor/EditorContainer.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'
import SettingsPanel from '@/components/Settings/SettingsPanel.vue'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const showSidebar = ref(true)
const isFullscreen = ref(false)
const showSettings = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

provide('showSidebar', showSidebar)
provide('isFullscreen', isFullscreen)
provide('showSettings', showSettings)

const { toggleTypewriterMode, toggleFocusMode } = useWritingEnhancement()

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
            window.electronAPI.openFolder()
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
            window.electronAPI.openFile()
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

  switch (format) {
    case 'html':
      exportContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.8;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    pre { background: #f5f5f5; padding: 16px; overflow-x: auto; border-radius: 4px; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
    blockquote { border-left: 4px solid #007AFF; padding-left: 16px; color: #666; }
    ul, ol { padding-left: 24px; }
  </style>
</head>
<body>
${markdownToBasicHtml(content)}
</body>
</html>`
      mimeType = 'text/html'
      extension = '.html'
      break
    case 'txt':
      exportContent = content
      mimeType = 'text/plain'
      extension = '.txt'
      break
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function markdownToBasicHtml(markdown: string): string {
  return markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/(.*?)\n\n/gim, '$1<p></p>')
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
    if (tabsStore.activeTabId) {
      tabsStore.setViewMode(tabsStore.activeTabId, mode as 'wysiwyg' | 'source' | 'split')
    }
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

  prefsStore.loadPreferences()

  if (tabsStore.tabCount === 0) {
    tabsStore.createTab({ title: '未命名' })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
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

.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  height: calc(100vh - 36px - 24px);
}
</style>
