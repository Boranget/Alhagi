<template>
  <div
    class="app-container"
    :class="{ 'is-fullscreen': isFullscreen, 'is-sticky-note': prefsStore.isStickyNoteMode, 'is-immersive': prefsStore.isImmersiveMode }"
  >
    <div class="app-content">
      <EnhancedSidebar 
        v-if="prefsStore.showSidebar" 
        @open-settings="showSettings = true" 
      />
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
    <CommandPalette
      :visible="showCommandPalette"
      @close="showCommandPalette = false"
    />
    <ShortcutsDialog
      :visible="showShortcuts"
      @close="showShortcuts = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useApp } from '@/composables/useApp'
import TabBar from '@/components/Tabs/TabBar.vue'
import EnhancedSidebar from '@/components/Sidebar/EnhancedSidebar.vue'
import EditorContainer from '@/components/Editor/EditorContainer.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'
import Welcome from '@/components/Welcome/Welcome.vue'

// 按需对话框：仅在用户触发时才加载，减小首屏 bundle 体积
const SettingsPanel = defineAsyncComponent(() => import('@/components/Settings/SettingsPanel.vue'))
const CommandPalette = defineAsyncComponent(() => import('@/components/CommandPalette/CommandPalette.vue'))
const ShortcutsDialog = defineAsyncComponent(() => import('@/components/Shortcuts/ShortcutsDialog.vue'))

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const { showSettings, isFullscreen, initializeApp } = useApp()

const showCommandPalette = ref(false)
const showShortcuts = ref(false)

let cleanup: (() => void) | null = null

onMounted(async () => {
  cleanup = await initializeApp()
  
  // 监听命令面板快捷键
  window.addEventListener('keydown', handleGlobalKeydown)
  
  // 监听鼠标滚轮缩放
  window.addEventListener('wheel', handleWheel, { passive: false })
  
  // 监听命令面板事件
  window.addEventListener('app:quickOpen', () => {
    showCommandPalette.value = true
  })
  
  window.addEventListener('app:showShortcuts', () => {
    showShortcuts.value = true
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('wheel', handleWheel)
  
  if (cleanup) {
    cleanup()
  }
})

// 全局快捷键处理
function handleGlobalKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + Shift + P: 命令面板
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    showCommandPalette.value = !showCommandPalette.value
    return
  }
  
  // Ctrl/Cmd + ,: 设置
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault()
    showSettings.value = true
    return
  }
}

// Ctrl+滚轮缩放处理
function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    
    const delta = e.deltaY > 0 ? -1 : 1
    if (delta > 0) {
      prefsStore.zoomIn()
    } else {
      prefsStore.zoomOut()
    }
  }
}
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
