<template>
  <div class="app-container" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="app-content">
      <TabBar />
      <div class="main-area">
        <EnhancedSidebar v-if="showSidebar" />
        <EditorContainer />
      </div>
      <StatusBar />
    </div>
    <SettingsPanel :isOpen="showSettings" @close="showSettings = false" />
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
  }, prefsStore.autoSaveDelay)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'F11') {
    e.preventDefault()
    isFullscreen.value = !isFullscreen.value
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
        tabsStore.createTab({ title: '未命名' })
        break
      case 'o':
        e.preventDefault()
        tabsStore.openFile()
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
        if (tabsStore.activeTabId) {
          tabsStore.removeTab(tabsStore.activeTabId)
        }
        break
    }
  }
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
      tabsStore.setViewMode(tabsStore.activeTabId, mode as any)
    }
  })
}

// 监听标签内容变化触发自动保存
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
