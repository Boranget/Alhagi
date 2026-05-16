<template>
  <div class="recent-files">
    <div class="recent-files-header">
      <span>最近文件</span>
      <div class="recent-files-actions">
        <button class="action-btn" title="清除历史记录" @click="clearHistory">
          🗑️
        </button>
      </div>
    </div>
    
    <div class="recent-files-list">
      <div v-if="pinnedFiles.length > 0" class="recent-files-section">
        <div class="section-header">已固定</div>
        <div v-for="file in pinnedFiles" :key="file.filePath" class="recent-file-item" @click="openFile(file)">
          <span class="file-icon">📄</span>
          <span class="file-name">{{ file.title }}</span>
          <button class="pin-btn" @click.stop="togglePin(file)" title="取消固定">
            📌
          </button>
        </div>
      </div>
      
      <div v-if="unpinnedFiles.length > 0" class="recent-files-section">
        <div class="section-header">最近</div>
        <div v-for="file in unpinnedFiles" :key="file.filePath" class="recent-file-item" @click="openFile(file)">
          <span class="file-icon">📄</span>
          <span class="file-name">{{ file.title }}</span>
          <button class="pin-btn" @click.stop="togglePin(file)" title="固定">
            📌
          </button>
        </div>
      </div>
      
      <div v-if="recentFiles.length === 0" class="empty-state">
        暂无最近打开的文件
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useTabsStore } from '@/stores/tabs'
import type { RecentFile } from '@/types'

const prefs = usePreferencesStore()
const tabs = useTabsStore()

const recentFiles = computed(() => prefs.recentFiles)

const pinnedFiles = computed(() => recentFiles.value.filter(f => f.pinned))
const unpinnedFiles = computed(() => recentFiles.value.filter(f => !f.pinned))

function openFile(file: RecentFile) {
  tabs.openRecentFile(file.filePath)
}

function togglePin(file: RecentFile) {
  prefs.pinRecentFile(file.filePath, !file.pinned)
}

function clearHistory() {
  if (confirm('确定要清除最近打开的文件历史（保留已固定）？')) {
    prefs.clearRecentFiles()
  }
}
</script>

<style scoped lang="scss">
.recent-files {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.recent-files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-color);
}

.recent-files-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.7;
  transition: all 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
    opacity: 1;
  }
}

.recent-files-list {
  flex: 1;
  overflow: auto;
  padding: 4px;
}

.recent-files-section {
  margin-bottom: 8px;
}

.section-header {
  padding: 6px 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.recent-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.file-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin-btn {
  padding: 2px 6px;
  border: none;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.5;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    opacity: 1;
    background: var(--sidebar-hover-bg);
  }
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 20px;
}
</style>
