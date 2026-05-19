<template>
  <div
    class="sidebar"
    :style="{ width: sidebarWidth + 'px' }"
  >
    <div class="sidebar-tabs">
      <button
        v-for="tab in sidebarTabs"
        :key="tab.id"
        class="sidebar-tab"
        :class="{ active: activeSidebarTab === tab.id }"
        :title="tab.label"
        @click="activeSidebarTab = tab.id"
      >
        <Icon
          :name="tab.icon"
          size="sm"
        />
      </button>
    </div>
    <div class="sidebar-content">
      <FileExplorer v-show="activeSidebarTab === 'files'" />
      <RecentFiles v-show="activeSidebarTab === 'recent'" />
      <GlobalSearch v-show="activeSidebarTab === 'search'" />
      <DocumentOutline v-show="activeSidebarTab === 'outline'" />
    </div>
    <div
      class="sidebar-resize-handle"
      @mousedown.prevent="startResize"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FileExplorer from './FileExplorer.vue'
import RecentFiles from './RecentFiles.vue'
import GlobalSearch from './GlobalSearch.vue'
import DocumentOutline from './DocumentOutline.vue'
import { Icon } from '@/components/Icons'

const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_DEFAULT_WIDTH = 280
const SIDEBAR_MAX_WIDTH = 500

const activeSidebarTab = ref<'files' | 'recent' | 'search' | 'outline'>('files')
const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH)

const sidebarTabs = [
  { id: 'files' as const, label: '文件资源管理器', icon: 'folder' },
  { id: 'recent' as const, label: '最近文件', icon: 'file' },
  { id: 'search' as const, label: '搜索', icon: 'search' },
  { id: 'outline' as const, label: '文档大纲', icon: 'list' }
]

onMounted(() => {
  const saved = localStorage.getItem('alhagi-sidebar-width')
  if (saved) {
    const parsed = parseInt(saved, 10)
    if (!isNaN(parsed)) {
      sidebarWidth.value = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, parsed))
    }
  }
})

function startResize(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const onMouseMove = (e: MouseEvent) => {
    const newWidth = startWidth + (e.clientX - startX)
    sidebarWidth.value = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth))
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const onMouseUp = () => {
    localStorage.setItem('alhagi-sidebar-width', String(sidebarWidth.value))
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped lang="scss">
.sidebar {
  min-width: 200px;
  max-width: 500px;
  display: flex;
  flex-direction: row;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  position: relative;
}

.sidebar-tabs {
  display: flex;
  flex-direction: column;
  width: 40px;
  padding: 4px;
  gap: 4px;
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
  align-items: stretch;
}

.sidebar-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  color: var(--text-secondary);

  &:hover {
    background: var(--sidebar-tab-hover-bg);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sidebar-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  z-index: 10;

  &:hover {
    background: var(--primary-color);
    opacity: 0.3;
  }
}
</style>
