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

    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div
        v-for="item in contextMenuItems"
        :key="item.id"
        class="context-menu-item"
        @click="handleContextMenuAction(item.id)"
      >
        <span class="item-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </div>
    </div>

    <div
      v-if="newItemDialog.show"
      class="dialog-overlay"
      @click.self="closeNewItemDialog"
    >
      <div class="dialog">
        <div class="dialog-header">
          {{ newItemDialog.isFolder ? '新建文件夹' : '新建文件' }}
        </div>
        <div class="dialog-body">
          <input
            ref="newItemInput"
            v-model="newItemDialog.name"
            type="text"
            placeholder="输入名称..."
            @keydown.enter="confirmNewItem"
            @keydown.escape="closeNewItemDialog"
          />
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="closeNewItemDialog">取消</button>
          <button class="btn btn-primary" @click="confirmNewItem">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useFileService } from '@/services/fileService'
import FileTreeNode from './FileTreeNode.vue'
import { useTabsStore } from '@/stores/tabs'
import { extractTitleFromPath } from '@/utils/helpers'
import type { FileTreeNodeType } from '@/types'

const fileService = useFileService()
const tabsStore = useTabsStore()
const { currentFolder, fileTree } = fileService
const newItemInput = ref<HTMLInputElement | null>(null)

interface ContextMenu {
  show: boolean
  x: number
  y: number
  node: FileTreeNodeType | null
}

interface ContextMenuItem {
  id: string
  label: string
  icon: string
}

interface NewItemDialog {
  show: boolean
  isFolder: boolean
  name: string
  targetNode: FileTreeNodeType | null
}

const contextMenu = ref<ContextMenu>({
  show: false,
  x: 0,
  y: 0,
  node: null
})

const newItemDialog = ref<NewItemDialog>({
  show: false,
  isFolder: false,
  name: '',
  targetNode: null
})

const contextMenuItems: ContextMenuItem[] = [
  { id: 'new-file', label: '新建文件', icon: '📄' },
  { id: 'new-folder', label: '新建文件夹', icon: '📁' },
  { id: 'rename', label: '重命名', icon: '✏️' },
  { id: 'delete', label: '删除', icon: '🗑️' },
  { id: 'copy-path', label: '复制路径', icon: '📋' },
  { id: 'open-in-explorer', label: '在系统文件管理器中显示', icon: '🗂️' }
]

async function openFolder() {
  const result = await fileService.openFolder()
  if (result) {
    await fileService.refreshTree()
  }
}

async function handleSelect(node: FileTreeNodeType) {
  if (node.type === 'file' && node.name.endsWith('.md')) {
    const content = await fileService.openFile(node.path)
    if (content !== null) {
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
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    node
  }
}

function handleGlobalClick() {
  if (contextMenu.value.show) {
    contextMenu.value.show = false
  }
}

function handleContextMenuAction(action: string) {
  const node = contextMenu.value.node
  contextMenu.value.show = false

  switch (action) {
    case 'new-file':
      openNewItemDialog(false, node)
      break
    case 'new-folder':
      openNewItemDialog(true, node)
      break
    case 'rename':
      handleRename(node)
      break
    case 'delete':
      handleDelete(node)
      break
    case 'copy-path':
      if (node) {
        navigator.clipboard.writeText(node.path)
      }
      break
    case 'open-in-explorer':
      handleOpenInExplorer(node)
      break
  }
}

function openNewItemDialog(isFolder: boolean, targetNode: FileTreeNodeType | null) {
  newItemDialog.value = {
    show: true,
    isFolder,
    name: '',
    targetNode
  }

  nextTick(() => {
    newItemInput.value?.focus()
  })
}

function closeNewItemDialog() {
  newItemDialog.value = {
    show: false,
    isFolder: false,
    name: '',
    targetNode: null
  }
}

async function confirmNewItem() {
  const { isFolder, name, targetNode } = newItemDialog.value
  if (!name.trim()) {
    return
  }

  let parentPath = currentFolder.value || ''
  if (targetNode) {
    if (targetNode.type === 'directory') {
      parentPath = targetNode.path
    } else {
      parentPath = targetNode.path.split('/').slice(0, -1).join('/')
    }
  }

  if (isFolder) {
    await fileService.createDirectory(parentPath, name)
  } else {
    await fileService.createFile(parentPath, name.endsWith('.md') ? name : name + '.md')
  }

  closeNewItemDialog()
}

function handleNewFile() {
  openNewItemDialog(false, null)
}

function handleNewFolder() {
  openNewItemDialog(true, null)
}

async function handleRename(node: FileTreeNodeType | null) {
  if (!node) return

  const newName = prompt('输入新名称:', node.name)
  if (newName && newName !== node.name) {
    await fileService.renameFile(node.path, newName)
  }
}

async function handleDelete(node: FileTreeNodeType | null) {
  if (!node) return

  const confirmMsg = node.type === 'directory' ? '确定要删除此文件夹吗？' : '确定要删除此文件吗？'
  if (confirm(confirmMsg)) {
    await fileService.deleteFile(node.path)
  }
}

function handleOpenInExplorer(node: FileTreeNodeType | null) {
  if (!node || !window.electronAPI) return
  console.log('Open in explorer:', node.path)
}

async function handleRefresh() {
  await fileService.refreshTree()
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  if (currentFolder.value) {
    fileService.refreshTree()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})
</script>

<style scoped lang="scss">
.file-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
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

.context-menu {
  position: fixed;
  background: var(--sidebar-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 180px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
  transition: background 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }

  &:first-child {
    border-radius: 4px 4px 0 0;
  }

  &:last-child {
    border-radius: 0 0 4px 4px;
  }
}

.item-icon {
  font-size: 12px;
  width: 16px;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--sidebar-bg);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  min-width: 300px;
}

.dialog-header {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.dialog-body {
  padding: 16px;

  input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 13px;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--primary-color);
  color: white;

  &:hover {
    opacity: 0.9;
  }
}

.btn-secondary {
  background: var(--sidebar-hover-bg);
  color: var(--text-primary);

  &:hover {
    background: var(--border-color);
  }
}
</style>
