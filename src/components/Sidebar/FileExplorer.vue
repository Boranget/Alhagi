<template>
  <div class="file-explorer">
    <div class="explorer-header">
      <span>资源管理器</span>
      <div class="header-actions">
        <button class="action-btn" title="新建文件" @click="handleNewFile">
          📄
        </button>
        <button class="action-btn" title="新建文件夹" @click="handleNewFolder">
          📁
        </button>
        <button class="action-btn" title="刷新" @click="handleRefresh">
          🔄
        </button>
      </div>
    </div>
    <div class="explorer-toolbar">
      <button class="toolbar-btn" @click="openFolder">
        打开文件夹
      </button>
    </div>
    <div class="file-tree" v-if="currentFolder">
      <FileTreeNode
        v-for="node in fileTree"
        :key="node.path"
        :node="node"
        :depth="0"
        @select="handleSelect"
        @contextmenu="handleContextMenu"
      />
    </div>
    <div v-else class="empty-state">
      <p>点击"打开文件夹"开始</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useFileService } from '@/services/fileService'
import FileTreeNode from './FileTreeNode.vue'
import { useTabsStore } from '@/stores/tabs'
import { extractTitleFromPath } from '@/utils/helpers'
import type { FileTreeNodeType } from '@/types'

const fileService = useFileService()
const tabsStore = useTabsStore()
const { currentFolder, fileTree } = fileService

async function openFolder() {
  const result = await fileService.openFolder()
  if (result) {
    await fileService.refreshTree()
  }
}

async function handleSelect(node: FileTreeNodeType) {
  if (node.type === 'file' && node.name.endsWith('.md')) {
    const content = await fileService.openFile(node.path)
    if (content) {
      const existingTab = Array.from(tabsStore.tabs.values()).find(
        t => t.filePath === node.path
      )
      
      if (existingTab) {
        tabsStore.switchTab(existingTab.id)
      } else {
        tabsStore.createTab({
          filePath: node.path,
          content: content,
          title: extractTitleFromPath(node.path)
        })
      }
    }
  }
}

function handleContextMenu(event: MouseEvent, node: FileTreeNodeType) {
  event.preventDefault()
  console.log('Context menu for:', node.path)
}

function handleNewFile() {
  console.log('Create new file')
}

function handleNewFolder() {
  console.log('Create new folder')
}

async function handleRefresh() {
  await fileService.refreshTree()
}

onMounted(() => {
  if (currentFolder.value) {
    fileService.refreshTree()
  }
})
</script>

<style scoped lang="scss">
.file-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.explorer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 4px 6px;
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.explorer-toolbar {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
}

.toolbar-btn {
  width: 100%;
  padding: 6px 12px;
  border: 1px dashed var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
}

.file-tree {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}
</style>
