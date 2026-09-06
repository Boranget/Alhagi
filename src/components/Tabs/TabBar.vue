<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <div
        v-for="tabId in tabsStore.tabOrder"
        :key="tabId"
        class="tab-item"
        :class="{ 
          active: tabId === tabsStore.activeTabId, 
          dirty: getTab(tabId)?.isDirty, 
          dragging: dragState.sourceTabId === tabId,
          'drag-over': dragState.targetTabId === tabId
        }"
        draggable="true"
        @click="handleTabClick(tabId)"
        @contextmenu.prevent="showContextMenu($event, tabId)"
        @mousedown.middle="handleTabClose(tabId)"
        @dragstart="handleDragStart($event, tabId)"
        @dragend="handleDragEnd($event)"
        @dragover.prevent="handleDragOver($event, tabId)"
        @dragenter.prevent="handleDragEnter($event, tabId)"
        @dragleave="handleDragLeave($event)"
        @drop="handleDrop($event, tabId)"
      >
        <span class="tab-title">{{ getTab(tabId)?.title || t('tabs.untitled') }}</span>
        <button
          class="tab-close"
          @click.stop="handleTabClose(tabId)"
        >
          <span
            v-if="getTab(tabId)?.isDirty"
            class="dirty-indicator"
          >●</span>
          <Icon 
            v-else 
            name="close" 
            size="sm" 
          />
        </button>
      </div>
    </div>
    <div class="tab-actions">
      <button
        class="new-tab-btn"
        @click="handleNewTab"
      >
        <Icon
          name="plus"
          size="sm"
        />
      </button>
    </div>

    <div
      v-if="contextMenu.show"
      class="tab-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div
        class="menu-item"
        @click="saveCurrentTab"
      >
        <Icon
          name="save"
          size="sm"
        />
        <span class="menu-text">{{ t('common.save') }}</span>
      </div>
      <div
        class="menu-item"
        @click="saveAsCurrentTab"
      >
        <Icon
          name="save"
          size="sm"
        />
        <span class="menu-text">{{ t('common.saveAs') }}</span>
      </div>
      <div class="menu-divider" />
      <div
        class="menu-item"
        @click="closeCurrentTab"
      >
        <Icon
          name="close"
          size="sm"
        />
        <span class="menu-text">{{ t('common.close') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeOtherTabs"
      >
        <Icon
          name="list"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.closeOtherTabs') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeSavedTabs"
      >
        <Icon
          name="folder"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.closeSavedTabs') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeAllTabs"
      >
        <Icon
          name="trash"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.closeAllTabs') }}</span>
      </div>
      <div
        v-if="getCurrentTab()?.filePath"
        class="menu-divider"
      />
      <div
        v-if="getCurrentTab()?.filePath"
        class="menu-item"
        @click="copyFilePath"
      >
        <Icon
          name="copy"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.copyPath') }}</span>
      </div>
      <div
        v-if="getCurrentTab()?.filePath"
        class="menu-item"
        @click="showInFolder"
      >
        <Icon
          name="folder-open"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.showInFolder') }}</span>
      </div>
      <div class="menu-divider" />
      <div
        class="menu-item"
        @click="detachTab"
      >
        <Icon
          name="maximize"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.detachToNewWindow') }}</span>
      </div>
    </div>
    
    <Teleport to="body">
      <div
        v-if="dragState.targetType === 'windowEdge' && windowList.length > 1"
        class="window-edge-indicator"
        :class="dragState.windowEdgeDirection"
      >
        <Icon 
          :name="dragState.windowEdgeDirection === 'left' ? 'chevron-left' : 'chevron-right'" 
          size="lg" 
        />
        <div class="edge-text">
          {{ t('tabs.releaseToMerge') }}
        </div>
      </div>
    </Teleport>
    
    <Teleport to="body">
      <div
        v-if="dragState.targetType === 'outsideWindow'"
        class="outside-window-indicator"
      >
        <Icon 
          name="maximize" 
          size="lg" 
        />
        <div class="outside-text">
          {{ t('tabs.releaseToNewWindow') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useTabDragDrop } from '@/composables/useTabDragDrop'
import { t } from '@/services/i18n'
import type { TabState } from '@/types'
import { Icon } from '@/components/Icons'
import { useTabService } from '@/services/tabService'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'

const tabsStore = useTabsStore()
const tabService = useTabService()
const { confirm } = useConfirmDialog()
const toast = useToast()

const {
  dragState,
  windowList,
  handleDragStart,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  serializeTabForIPC
} = useTabDragDrop()

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  tabId: null as string | null
})

function getTab(tabId: string): TabState | undefined {
  return tabsStore.tabs.get(tabId)
}

function getCurrentTab(): TabState | undefined {
  if (contextMenu.value.tabId) {
    return getTab(contextMenu.value.tabId)
  }
  return undefined
}

function handleTabClick(tabId: string) {
  tabsStore.switchTab(tabId)
  hideContextMenu()
}

function showContextMenu(event: MouseEvent, tabId: string) {
  tabsStore.switchTab(tabId)

  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    tabId
  }
}

function hideContextMenu() {
  contextMenu.value.show = false
  contextMenu.value.tabId = null
}

function handleGlobalKeydown() {
  // 暂时不需要全局键盘事件处理
}

function handleGlobalClick() {
  hideContextMenu()
}

async function confirmCloseDirtyTab(tab: TabState): Promise<boolean> {
  return await confirm({
    title: '未保存的更改',
    message: `文件 "${tab.title}" 有未保存的更改，确定要关闭吗？`,
    confirmText: '关闭',
    cancelText: '取消',
    danger: true,
  })
}

async function handleTabClose(tabId: string) {
  const tab = getTab(tabId)
  if (tab?.isDirty) {
    const ok = await confirmCloseDirtyTab(tab)
    if (!ok) return
  }
  tabsStore.removeTab(tabId)
}

function handleNewTab() {
  tabsStore.createTab()
}

function saveCurrentTab() {
  if (contextMenu.value.tabId) {
    tabService.saveFile(contextMenu.value.tabId)
  }
  hideContextMenu()
}

function saveAsCurrentTab() {
  if (contextMenu.value.tabId) {
    tabService.saveFileAs(contextMenu.value.tabId)
  }
  hideContextMenu()
}

async function closeCurrentTab() {
  if (contextMenu.value.tabId) {
    await handleTabClose(contextMenu.value.tabId)
  }
  hideContextMenu()
}

async function closeOtherTabs() {
  const activeTabId = tabsStore.activeTabId
  const allTabIds = Array.from(tabsStore.tabs.keys())

  for (const tabId of allTabIds) {
    if (tabId !== activeTabId) {
      const tab = getTab(tabId)
      if (tab?.isDirty) {
        const ok = await confirmCloseDirtyTab(tab)
        if (!ok) continue
      }
      tabsStore.removeTab(tabId)
    }
  }
  hideContextMenu()
}

function closeSavedTabs() {
  const allTabIds = Array.from(tabsStore.tabs.keys())

  for (const tabId of allTabIds) {
    const tab = getTab(tabId)
    if (!tab?.isDirty && tabsStore.tabCount > 1) {
      tabsStore.removeTab(tabId)
    }
  }
  hideContextMenu()
}

async function closeAllTabs() {
  const allTabIds = Array.from(tabsStore.tabs.keys())
  const hasDirtyTab = allTabIds.some((tabId) => getTab(tabId)?.isDirty)

  if (hasDirtyTab) {
    const ok = await confirm({
      title: '未保存的更改',
      message: '有些文件有未保存的更改，确定要关闭全部吗？',
      confirmText: '关闭全部',
      cancelText: '取消',
      danger: true,
    })
    if (!ok) {
      hideContextMenu()
      return
    }
  }

  for (const tabId of allTabIds) {
    tabsStore.removeTab(tabId)
  }

  hideContextMenu()
}

function copyFilePath() {
  const tab = getCurrentTab()
  if (tab?.filePath) {
    navigator.clipboard.writeText(tab.filePath)
  }
  hideContextMenu()
}

async function showInFolder() {
  const tab = getCurrentTab()
  if (tab?.filePath && window.electronAPI) {
    try {
      await window.electronAPI.showInFolder(tab.filePath)
    } catch (error) {
      // Silent fail - folder navigation errors
    }
  }
  hideContextMenu()
}

async function detachTab() {
  const tabId = contextMenu.value.tabId
  if (!tabId) return
  
  const tab = getTab(tabId)
  if (!tab) return
  
  if (window.electronAPI) {
    try {
      await window.electronAPI.openNewWindow({ tabData: serializeTabForIPC(tab) })
      tabsStore.removeTab(tabId)
    } catch (e) {
      toast.error('分离标签页失败，请重试')
    }
  } else {
    toast.warning('此功能仅在 Electron 环境下可用')
  }
  
  hideContextMenu()
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  document.addEventListener('keydown', handleGlobalKeydown)
  
  const tabsContainer = document.querySelector('.tabs-container') as HTMLElement
  if (tabsContainer) {
    tabsContainer.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault()
      tabsContainer.scrollLeft += e.deltaY
    }, { passive: false })
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped lang="scss">
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--tab-bar-bg);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  position: relative;
}

.tabs-container {
  flex: 1;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-color);
    border-radius: 2px;
  }
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  min-width: 120px;
  max-width: 200px;
  background: var(--tab-bg);
  border-right: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--tab-hover-bg);
  }

  &.active {
    background: var(--tab-active-bg);
    border-bottom: 2px solid var(--primary-color);
  }
  
  &.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }
  
  &.drag-over {
    background: var(--sidebar-hover-bg);
    border-bottom: 2px dashed var(--primary-color);
  }
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--close-btn-hover-bg);
    color: var(--text-primary);
  }
}

.dirty-indicator {
  color: var(--primary-color);
  font-size: 10px;
}

.tab-actions {
  display: flex;
  align-items: center;
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--tab-hover-bg);
    color: var(--text-primary);
  }
}

.new-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--tab-hover-bg);
    color: var(--text-primary);
  }
}

.tab-context-menu {
  position: fixed;
  background: var(--sidebar-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 180px;
  padding: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.menu-text {
  flex: 1;
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}
</style>

<style>
.tab-drag-image {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  background: var(--tab-active-bg, #fff);
  border: 1px solid var(--primary-color, #409eff);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary, #333);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.window-edge-indicator {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 9998;
  transition: opacity 0.2s;
  
  &.left {
    left: 0;
    background: linear-gradient(to right, rgba(64, 158, 255, 0.8), transparent);
  }
  
  &.right {
    right: 0;
    background: linear-gradient(to left, rgba(64, 158, 255, 0.8), transparent);
  }
  
  .edge-text {
    font-size: 11px;
    color: white;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    white-space: nowrap;
    margin-top: 8px;
  }
}

.outside-window-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(64, 158, 255, 0.9);
  border-radius: 8px;
  padding: 20px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  z-index: 9998;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  color: white;
  
  .outside-text {
    font-size: 14px;
    font-weight: 500;
  }
}
</style>
