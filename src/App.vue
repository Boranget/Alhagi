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
import { eventBus, AppEvents } from '@/events/eventBus'
import TabBar from '@/components/Tabs/TabBar.vue'
import EnhancedSidebar from '@/components/Sidebar/EnhancedSidebar.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'
import Welcome from '@/components/Welcome/Welcome.vue'

// 按需对话框：仅在用户触发时才加载，减小首屏 bundle 体积
const SettingsPanel = defineAsyncComponent(() => import('@/components/Settings/SettingsPanel.vue'))
const CommandPalette = defineAsyncComponent(() => import('@/components/CommandPalette/CommandPalette.vue'))
const ShortcutsDialog = defineAsyncComponent(() => import('@/components/Shortcuts/ShortcutsDialog.vue'))
// 编辑器异步加载（P2-9）：仅当有打开文件时拉取 milkdown/crepe + codemirror，
// 让 Welcome 页面首屏体积减小 ~1MB（gz ~300KB）。
const EditorContainer = defineAsyncComponent(() => import('@/components/Editor/EditorContainer.vue'))

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const { showSettings, isFullscreen, initializeApp } = useApp()

const showCommandPalette = ref(false)
const showShortcuts = ref(false)

let cleanup: (() => void) | null = null
const eventUnsubscribers: (() => void)[] = []

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

onMounted(async () => {
  cleanup = await initializeApp()

  window.addEventListener('wheel', handleWheel, { passive: false })

  // 全局对话框开关订阅 —— dispatcher 通过 eventBus 触发
  eventUnsubscribers.push(
    eventBus.on(AppEvents.SHOW_COMMAND_PALETTE, () => {
      showCommandPalette.value = !showCommandPalette.value
    }),
  )
  eventUnsubscribers.push(
    eventBus.on(AppEvents.SHOW_SHORTCUTS, () => {
      showShortcuts.value = true
    }),
  )
})

onUnmounted(() => {
  window.removeEventListener('wheel', handleWheel)
  for (const unsubscribe of eventUnsubscribers) unsubscribe()
  eventUnsubscribers.length = 0

  if (cleanup) {
    cleanup()
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
