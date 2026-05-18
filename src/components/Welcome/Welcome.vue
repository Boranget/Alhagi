<template>
  <div class="welcome-container">
    <div class="welcome-content">
      <h1 class="welcome-title">欢迎使用顾念笔记</h1>
      <p class="welcome-subtitle">一个简洁而强大的 Markdown 编辑器</p>
      
      <div class="welcome-actions">
        <button class="action-button primary" @click="createNewFile">
          <Icon name="plus" size="lg" />
          <span class="action-text">新建文件</span>
        </button>
        
        <button class="action-button" @click="openExistingFile">
          <Icon name="file" size="lg" />
          <span class="action-text">打开文件</span>
        </button>
        
        <button class="action-button" @click="openFolder">
          <Icon name="folder-open" size="lg" />
          <span class="action-text">打开文件夹</span>
        </button>
      </div>
      
      <div class="welcome-section">
        <h2 class="section-title">最近文件</h2>
        <div v-if="recentFiles.length > 0" class="recent-files-list">
          <div 
            v-for="file in recentFiles" 
            :key="file.filePath"
            class="recent-file-item"
            @click="openRecentFile(file)"
          >
            <Icon name="file" size="sm" />
            <span class="file-name">{{ file.title }}</span>
          </div>
        </div>
        <div v-else class="no-files">暂无最近文件</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePreferencesStore } from '@/stores/preferences'
import { useTabsStore } from '@/stores/tabs'
import { useFileService } from '@/services/fileService'
import { computed } from 'vue'
import { Icon } from '@/components/Icons'

const prefsStore = usePreferencesStore()
const tabsStore = useTabsStore()
const fileService = useFileService()

const recentFiles = computed(() => prefsStore.recentFiles)

function createNewFile() {
  tabsStore.createTab({ title: '未命名' })
}

async function openExistingFile() {
  if (window.electronAPI) {
    const result = await window.electronAPI.openFile()
    if (result.success && result.data) {
      const { filePath, content } = result.data
      const title = filePath.split('/').pop()?.split('\\').pop() || '未命名'
      tabsStore.createTab({
        title,
        content,
        filePath
      })
      prefsStore.addRecentFile(filePath, title)
    }
  } else {
    await tabsStore.openFile()
  }
}

async function openFolder() {
  if (window.electronAPI) {
    const result = await window.electronAPI.openFolder()
    if (result.success && result.data) {
      // 使用 fileService 打开文件夹，这样会自动更新文件树
      await fileService.openFolderByPath(result.data.path)
    }
  }
}

function openRecentFile(file: any) {
  if (window.electronAPI && file.filePath) {
    window.electronAPI.readFile(file.filePath).then((result: any) => {
      if (result.success) {
        tabsStore.createTab({
          title: file.title,
          content: result.content,
          filePath: file.filePath
        })
        prefsStore.addRecentFile(file.filePath, file.title)
      }
    })
  }
}
</script>

<style scoped lang="scss">
.welcome-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.welcome-content {
  max-width: 600px;
  text-align: center;
  padding: 40px;
}

.welcome-title {
  font-size: 36px;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-weight: 600;
}

.welcome-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 48px;
}

.welcome-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 48px;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 32px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 140px;

  &:hover {
    background: var(--sidebar-hover-bg);
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }

  &.primary {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;

    &:hover {
      opacity: 0.9;
    }
  }
}

.action-text {
  font-size: 14px;
  font-weight: 500;
}

.welcome-section {
  text-align: left;
}

.section-title {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 20px;
  font-weight: 600;
}

.recent-files-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.file-name {
  font-size: 14px;
  color: var(--text-primary);
}

.no-files {
  padding: 24px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 14px;
}
</style>
