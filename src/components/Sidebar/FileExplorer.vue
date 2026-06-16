<template>
  <div class="file-explorer">
    <div class="explorer-header">
      <span>{{ t('sidebar.fileExplorer') }}</span>
      <div class="header-actions">
        <button
          class="action-btn"
          :title="t('common.newFile')"
          @click="handleNewFile"
        >
          <Icon
            name="file"
            size="sm"
          />
        </button>
        <button
          class="action-btn"
          :title="t('common.newFolder')"
          @click="handleNewFolder"
        >
          <Icon
            name="folder"
            size="sm"
          />
        </button>
        <button
          class="action-btn"
          :title="t('common.refresh')"
          @click="handleRefresh"
        >
          <Icon
            name="refresh"
            size="sm"
          />
        </button>
      </div>
    </div>
    <div class="explorer-toolbar">
      <button
        class="toolbar-btn"
        @click="openFolder"
      >
        {{ t('common.openFolder') }}
      </button>
    </div>
    <div
      v-if="fileStore.currentFolder"
      class="file-tree"
    >
      <FileTreeNode
        v-for="node in fileStore.fileTree"
        :key="node.path"
        :node="node"
        :depth="0"
        @select="handleSelect"
        @contextmenu="handleContextMenu"
        @toggle="handleToggle"
      />
    </div>
    <div
      v-else
      class="empty-state"
    >
      <p>{{ t('sidebar.clickToStart') }}</p>
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
        <Icon
          :name="item.icon"
          size="sm"
        />
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
          {{ newItemDialog.isFolder ? t('common.newFolder') : t('common.newFile') }}
        </div>
        <div class="dialog-body">
          <input
            ref="newItemInput"
            v-model="newItemDialog.name"
            type="text"
            placeholder="输入名称..."
            @keydown.enter="confirmNewItem"
            @keydown.escape="closeNewItemDialog"
          >
        </div>
        <div class="dialog-footer">
          <button
            class="btn btn-secondary"
            @click="closeNewItemDialog"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="btn btn-primary"
            @click="confirmNewItem"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import FileTreeNode from './FileTreeNode.vue'
import { useTabsStore } from '@/stores/tabs'
import { extractTitleFromPath, getDirname } from '@/utils/helpers'
import { detectFileType } from '@/utils/tabHelpers'
import type { FileTreeNodeType } from '@/types'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

const fileStore = useFileExplorerStore()
const tabsStore = useTabsStore()
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

const baseContextMenuItems: ContextMenuItem[] = [
  { id: 'new-file', label: t('common.newFile'), icon: 'file' },
  { id: 'new-folder', label: t('common.newFolder'), icon: 'folder' },
  { id: 'rename', label: t('common.rename'), icon: 'edit' },
  { id: 'delete', label: t('common.delete'), icon: 'trash' },
  { id: 'copy-path', label: '复制路径', icon: 'copy' },
  { id: 'open-in-explorer', label: '在系统文件管理器中显示', icon: 'folder' }
]

const fileOnlyMenuItems: ContextMenuItem[] = [
  { id: 'move-to', label: '移动到...', icon: 'folder' },
  { id: 'copy-to', label: '复制到...', icon: 'copy' }
]

const contextMenuItems = computed(() => {
  if (!contextMenu.value.node) return baseContextMenuItems
  if (contextMenu.value.node.type === 'file') {
    const result = [...baseContextMenuItems]
    const renameIndex = result.findIndex(item => item.id === 'rename')
    if (renameIndex !== -1) {
      result.splice(renameIndex + 1, 0, ...fileOnlyMenuItems)
    }
    return result
  }
  return baseContextMenuItems
})

async function openFolder() {
  const result = await fileStore.openFolder()
  if (result) {
    await fileStore.refreshTree()
  }
}

async function handleSelect(node: FileTreeNodeType) {
  if (node.type !== 'file') return

  // 首先检查文件是否已在其他窗口打开
  if (window.electronAPI) {
    const checkResult = await window.electronAPI.checkFileOpen(node.path)
    if (checkResult.success && checkResult.data && checkResult.data.windowId !== null) {
      await window.electronAPI.focusWindow(checkResult.data.windowId, node.path)
      return
    }
  }

  // 已经在本窗口打开了 → 切到那个 tab
  const existingTab = Array.from(tabsStore.tabs.values()).find(t => t.filePath === node.path)
  if (existingTab) {
    tabsStore.switchTab(existingTab.id)
    return
  }

  // 按文件类型分流：
  //   - editor (markdown)：UTF-8 读全文塞 tab.content，让 Crepe 渲染
  //   - image：不读内容（ImagePreview 自己用 readBinaryFile），content 留空
  //              避免把图片二进制当 UTF-8 读出来灌进 Crepe，污染 isDirty
  //   - unsupported：同样不读，仅展示提示
  const fileType = detectFileType(node.path)
  let content = ''

  if (fileType === 'editor' && window.electronAPI) {
    try {
      const response = await window.electronAPI.readFile(node.path)
      if (response?.success && response.data !== undefined) {
        content = response.data
      } else {
        return // 读失败，不创建 tab
      }
    } catch {
      return
    }
  }

  tabsStore.createTab({
    filePath: node.path,
    content,
    title: extractTitleFromPath(node.path),
    fileType,
  })
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

function handleToggle(node: FileTreeNodeType) {
  if (node.type === 'directory') {
    fileStore.toggleFolder(node)
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
    case 'move-to':
      handleMoveTo(node)
      break
    case 'copy-to':
      handleCopyTo(node)
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

async function handleMoveTo(node: FileTreeNodeType | null) {
  if (!node || !window.electronAPI) return
  
  const result = await window.electronAPI.selectDirectory()
  if (result.success && result.data) {
    const targetDir = result.data
    const sourcePath = node.type === 'file' ? node.path : null
    
    if (!sourcePath) {
      return
    }
    
    const moveResult = await window.electronAPI.moveFile(sourcePath, targetDir)
    if (moveResult.success && moveResult.data) {
      await fileStore.refreshTree()
      
      const existingTab = Array.from(tabsStore.tabs.values()).find(t => t.filePath === sourcePath)
      if (existingTab) {
        tabsStore.updateTab(existingTab.id, { filePath: moveResult.data })
      }
    }
  }
}

async function handleCopyTo(node: FileTreeNodeType | null) {
  if (!node || !window.electronAPI) return
  
  const result = await window.electronAPI.selectDirectory()
  if (result.success && result.data) {
    const targetDir = result.data
    const sourcePath = node.type === 'file' ? node.path : null
    
    if (!sourcePath) {
      return
    }
    
    const copyResult = await window.electronAPI.copyFile(sourcePath, targetDir)
    if (copyResult.success && copyResult.data) {
      await fileStore.refreshTree()
    }
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

  let parentPath = fileStore.currentFolder || ''
  if (targetNode) {
    if (targetNode.type === 'directory') {
      parentPath = targetNode.path
    } else {
      parentPath = getDirname(targetNode.path)
    }
  }

  const finalName = isFolder ? name : (name.endsWith('.md') ? name : name + '.md')

  if (isFolder) {
    await fileStore.createDirectory(parentPath, name)
  } else {
    await fileStore.createFile(parentPath, finalName)
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

  const newName = prompt(t('common.rename') + ':', node.name)
  if (newName && newName !== node.name) {
    await fileStore.renameFile(node.path, newName)
  }
}

async function handleDelete(node: FileTreeNodeType | null) {
  if (!node) return

  const confirmMsg = node.type === 'directory' ? t('common.delete') + '文件夹?' : t('common.delete') + '文件?'
  if (confirm(confirmMsg)) {
    await fileStore.deleteFile(node.path)
  }
}

async function handleOpenInExplorer(node: FileTreeNodeType | null) {
  if (!node || !window.electronAPI) return
  try {
    await window.electronAPI.showInFolder(node.path)
  } catch {
    // 忽略显示错误
  }
}

async function handleRefresh() {
  await fileStore.refreshTree()
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  if (fileStore.currentFolder) {
    fileStore.refreshTree()
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  color: var(--text-secondary);

  &:hover {
    background: var(--sidebar-hover-bg);
    color: var(--text-primary);
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
