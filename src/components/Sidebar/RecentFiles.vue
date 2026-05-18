<template>
  <div class="recent-files">
    <div class="recent-files-header">
      <span>{{ t('sidebar.recentFiles') }}</span>
      <div class="recent-files-actions">
        <button
          class="action-btn"
          :title="t('sidebar.clearHistory')"
          @click="clearHistory"
        >
          <Icon name="trash" size="sm" />
        </button>
      </div>
    </div>

    <div class="recent-files-list">
      <div
        v-if="pinnedFolders.length > 0 || unpinnedFolders.length > 0"
        class="recent-files-section"
      >
        <div class="section-header">
          <Icon name="folder" size="sm" />
          {{ t('common.openFolder') }}
        </div>
        <div
          v-for="folder in pinnedFolders"
          :key="folder.folderPath"
          class="recent-file-item"
          @click="openFolder(folder)"
        >
          <Icon name="folder" size="sm" class="file-icon" />
          <span class="file-name">{{ folder.name }}</span>
          <button
            class="pin-btn"
            :title="t('sidebar.unpin')"
            @click.stop="togglePinFolder(folder)"
          >
            <Icon name="pin" size="sm" />
          </button>
        </div>
        <div
          v-for="folder in unpinnedFolders"
          :key="folder.folderPath"
          class="recent-file-item"
          @click="openFolder(folder)"
        >
          <Icon name="folder" size="sm" class="file-icon" />
          <span class="file-name">{{ folder.name }}</span>
          <button
            class="pin-btn"
            :title="t('sidebar.pin')"
            @click.stop="togglePinFolder(folder)"
          >
            <Icon name="pin" size="sm" />
          </button>
        </div>
      </div>

      <div
        v-if="pinnedFiles.length > 0 || unpinnedFiles.length > 0"
        class="recent-files-section"
      >
        <div class="section-header">
          <Icon name="file" size="sm" />
          {{ t('common.openFile') }}
        </div>
        <div
          v-for="file in pinnedFiles"
          :key="file.filePath"
          class="recent-file-item"
          @click="openFile(file)"
        >
          <Icon name="file" size="sm" class="file-icon" />
          <span class="file-name">{{ file.title }}</span>
          <button
            class="pin-btn"
            :title="t('sidebar.unpin')"
            @click.stop="togglePinFile(file)"
          >
            <Icon name="pin" size="sm" />
          </button>
        </div>
        <div
          v-for="file in unpinnedFiles"
          :key="file.filePath"
          class="recent-file-item"
          @click="openFile(file)"
        >
          <Icon name="file" size="sm" class="file-icon" />
          <span class="file-name">{{ file.title }}</span>
          <button
            class="pin-btn"
            :title="t('sidebar.pin')"
            @click.stop="togglePinFile(file)"
          >
            <Icon name="pin" size="sm" />
          </button>
        </div>
      </div>

      <div
        v-if="recentFiles.length === 0 && recentFolders.length === 0"
        class="empty-state"
      >
        {{ t('sidebar.clickToStart') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useTabsStore } from '@/stores/tabs'
import { useFileService } from '@/services/fileService'
import { eventBus, AppEvents } from '@/events/eventBus'
import type { RecentFile, RecentFolder } from '@/types'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

const prefs = usePreferencesStore()
const tabs = useTabsStore()
const fileService = useFileService()

const recentFiles = computed(() => prefs.recentFiles)
const recentFolders = computed(() => prefs.recentFolders)

const pinnedFiles = computed(() => recentFiles.value.filter(f => f.pinned))
const unpinnedFiles = computed(() => recentFiles.value.filter(f => !f.pinned))
const pinnedFolders = computed(() => recentFolders.value.filter(f => f.pinned))
const unpinnedFolders = computed(() => recentFolders.value.filter(f => !f.pinned))

function openFile(file: RecentFile) {
  tabs.openRecentFile(file.filePath)
}

async function openFolder(folder: RecentFolder) {
  await fileService.openFolderByPath(folder.folderPath)
  eventBus.emit(AppEvents.FOLDER_OPENED, { folderPath: folder.folderPath })
}

function togglePinFile(file: RecentFile) {
  prefs.pinRecentFile(file.filePath, !file.pinned)
}

function togglePinFolder(folder: RecentFolder) {
  prefs.pinRecentFolder(folder.folderPath, !folder.pinned)
}

function clearHistory() {
  if (confirm(t('sidebar.clearHistory'))) {
    prefs.clearRecentFiles()
    prefs.clearRecentFolders()
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.7;
  transition: all 0.15s;
  color: var(--text-secondary);

  &:hover {
    background: var(--sidebar-hover-bg);
    opacity: 1;
    color: var(--text-primary);
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
  display: flex;
  align-items: center;
  gap: 4px;
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
  flex-shrink: 0;
  color: var(--text-secondary);
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.5;
  flex-shrink: 0;
  transition: all 0.15s;
  color: var(--text-secondary);

  &:hover {
    opacity: 1;
    background: var(--sidebar-hover-bg);
    color: var(--text-primary);
  }
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 20px;
}
</style>
