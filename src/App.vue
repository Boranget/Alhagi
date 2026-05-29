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
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useApp } from '@/composables/useApp'
import TabBar from '@/components/Tabs/TabBar.vue'
import EnhancedSidebar from '@/components/Sidebar/EnhancedSidebar.vue'
import EditorContainer from '@/components/Editor/EditorContainer.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'
import SettingsPanel from '@/components/Settings/SettingsPanel.vue'
import Welcome from '@/components/Welcome/Welcome.vue'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const { showSettings, isFullscreen, initializeApp } = useApp()

let cleanup: (() => void) | null = null

onMounted(async () => {
  cleanup = await initializeApp()
})

onUnmounted(() => {
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
