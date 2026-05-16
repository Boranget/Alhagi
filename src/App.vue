<template>
  <div class="app-container" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="app-content">
      <TabBar />
      <div class="main-area">
        <Sidebar v-if="showSidebar" />
        <EditorContainer />
      </div>
      <StatusBar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import TabBar from '@/components/Tabs/TabBar.vue'
import Sidebar from '@/components/Sidebar/Sidebar.vue'
import EditorContainer from '@/components/Editor/EditorContainer.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'

const tabsStore = useTabsStore()
const showSidebar = ref(true)
const isFullscreen = ref(false)

provide('showSidebar', showSidebar)
provide('isFullscreen', isFullscreen)

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'F11') {
    e.preventDefault()
    isFullscreen.value = !isFullscreen.value
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  
  if (tabsStore.tabCount === 0) {
    tabsStore.createTab({ title: '未命名' })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
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
  height: calc(100vh - 36px - 36px);
}
</style>
