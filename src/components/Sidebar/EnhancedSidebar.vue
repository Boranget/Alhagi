<template>
  <div class="sidebar">
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FileExplorer from './FileExplorer.vue'
import RecentFiles from './RecentFiles.vue'
import GlobalSearch from './GlobalSearch.vue'
import DocumentOutline from './DocumentOutline.vue'
import { Icon } from '@/components/Icons'

const activeSidebarTab = ref<'files' | 'recent' | 'search' | 'outline'>('files')

const sidebarTabs = [
  { id: 'files' as const, label: '文件资源管理器', icon: 'folder' },
  { id: 'recent' as const, label: '最近文件', icon: 'file' },
  { id: 'search' as const, label: '搜索', icon: 'search' },
  { id: 'outline' as const, label: '文档大纲', icon: 'list' }
]
</script>

<style scoped lang="scss">
.sidebar {
  width: 280px;
  min-width: 200px;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
}

.sidebar-tabs {
  display: flex;
  padding: 4px;
  gap: 4px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
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
}
</style>
