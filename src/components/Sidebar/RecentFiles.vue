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
          <Icon
            name="trash"
            size="sm"
          />
        </button>
      </div>
    </div>

    <div class="recent-files-tabs">
      <button
        class="recent-files-tab"
        :class="{ active: activeTab === 'files' }"
        @click="activeTab = 'files'"
      >
        <Icon
          name="file"
          size="sm"
        />
        {{ t('common.file') }}
      </button>
      <button
        class="recent-files-tab"
        :class="{ active: activeTab === 'folders' }"
        @click="activeTab = 'folders'"
      >
        <Icon
          name="folder"
          size="sm"
        />
        {{ t('common.folder') }}
      </button>
    </div>

    <div class="recent-files-list">
      <!-- 文件列表 -->
      <template v-if="activeTab === 'files'">
        <div
          v-if="pinnedFiles.length > 0 || unpinnedFiles.length > 0"
          class="recent-files-section"
        >
          <div
            v-for="file in pinnedFiles"
            :key="file.filePath"
            class="recent-file-item"
            @click="openFile(file)"
          >
            <Icon
              name="file"
              size="sm"
              class="file-icon"
            />
            <span class="file-name">{{ file.title }}</span>
            <button
              class="pin-btn"
              :title="t('sidebar.unpin')"
              @click.stop="togglePinFile(file)"
            >
              <Icon
                name="pin"
                size="sm"
              />
            </button>
          </div>
          <div
            v-for="file in unpinnedFiles"
            :key="file.filePath"
            class="recent-file-item"
            @click="openFile(file)"
          >
            <Icon
              name="file"
              size="sm"
              class="file-icon"
            />
            <span class="file-name">{{ file.title }}</span>
            <button
              class="pin-btn"
              :title="t('sidebar.pin')"
              @click.stop="togglePinFile(file)"
            >
              <Icon
                name="pin"
                size="sm"
              />
            </button>
          </div>
        </div>
        <div
          v-else
          class="empty-state"
        >
          {{ t('sidebar.clickToStart') }}
        </div>
      </template>

      <!-- 文件夹列表 -->
      <template v-if="activeTab === 'folders'">
        <div
          v-if="pinnedFolders.length > 0 || unpinnedFolders.length > 0"
          class="recent-files-section"
        >
          <div
            v-for="folder in pinnedFolders"
            :key="folder.folderPath"
            class="recent-file-item"
            @click="openFolder(folder)"
          >
            <Icon
              name="folder"
              size="sm"
              class="file-icon"
            />
            <span class="file-name">{{ folder.name }}</span>
            <button
              class="pin-btn"
              :title="t('sidebar.unpin')"
              @click.stop="togglePinFolder(folder)"
            >
              <Icon
                name="pin"
                size="sm"
              />
            </button>
          </div>
          <div
            v-for="folder in unpinnedFolders"
            :key="folder.folderPath"
            class="recent-file-item"
            @click="openFolder(folder)"
          >
            <Icon
              name="folder"
              size="sm"
              class="file-icon"
            />
            <span class="file-name">{{ folder.name }}</span>
            <button
              class="pin-btn"
              :title="t('sidebar.pin')"
              @click.stop="togglePinFolder(folder)"
            >
              <Icon
                name="pin"
                size="sm"
              />
            </button>
          </div>
        </div>
        <div
          v-else
          class="empty-state"
        >
          {{ t('sidebar.clickToStart') }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useTabService } from '@/services/tabService'
import type { RecentFile, RecentFolder } from '@/types'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

const activeTab = ref<'files' | 'folders'>('files')

const prefs = usePreferencesStore()
const fileStore = useFileExplorerStore()
const tabService = useTabService()

const recentFiles = computed(() => prefs.recentFiles)
const recentFolders = computed(() => prefs.recentFolders)

const pinnedFiles = computed(() => recentFiles.value.filter(f => f.pinned))
const unpinnedFiles = computed(() => recentFiles.value.filter(f => !f.pinned))
const pinnedFolders = computed(() => recentFolders.value.filter(f => f.pinned))
const unpinnedFolders = computed(() => recentFolders.value.filter(f => !f.pinned))

function openFile(file: RecentFile) {
  tabService.openRecentFile(file.filePath)
}

async function openFolder(folder: RecentFolder) {
  await fileStore.openFolderByPath(folder.folderPath)
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
    if (activeTab.value === 'files') {
      prefs.clearRecentFiles()
    } else {
      prefs.clearRecentFolders()
    }
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

.recent-files-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.recent-files-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  padding: 6px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;

  &:hover {
    color: var(--text-primary);
    background: var(--sidebar-hover-bg);
  }

  &.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
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