<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <div
        v-for="tabId in filteredTabOrder"
        :key="tabId"
        class="tab-item"
        :class="{ active: tabId === tabsStore.activeTabId, dirty: getTab(tabId)?.isDirty, dragging: draggingTabId === tabId }"
        draggable="true"
        @click="handleTabClick(tabId)"
        @contextmenu.prevent="showContextMenu($event, tabId)"
        @mousedown.middle="handleTabClose(tabId)"
        @dragstart="handleDragStart($event, tabId)"
        @dragend="handleDragEnd"
        @dragover.prevent="handleDragOver($event, tabId)"
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
        class="search-btn"
        title="搜索标签 (Ctrl+P)"
        @click="toggleSearch"
      >
        <Icon name="search" size="sm" />
      </button>
      <button
        class="new-tab-btn"
        @click="handleNewTab"
      >
        <Icon name="plus" size="sm" />
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
        <Icon name="save" size="sm" />
        <span class="menu-text">{{ t('common.save') }}</span>
      </div>
      <div
        class="menu-item"
        @click="saveAsCurrentTab"
      >
        <Icon name="save" size="sm" />
        <span class="menu-text">{{ t('common.saveAs') }}</span>
      </div>
      <div class="menu-divider" />
      <div
        class="menu-item"
        @click="closeCurrentTab"
      >
        <Icon name="close" size="sm" />
        <span class="menu-text">{{ t('common.close') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeOtherTabs"
      >
        <Icon name="list" size="sm" />
        <span class="menu-text">{{ t('tabs.closeOtherTabs') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeSavedTabs"
      >
        <Icon name="folder" size="sm" />
        <span class="menu-text">{{ t('tabs.closeSavedTabs') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeAllTabs"
      >
        <Icon name="trash" size="sm" />
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
        <Icon name="copy" size="sm" />
        <span class="menu-text">{{ t('tabs.copyPath') }}</span>
      </div>
      <div class="menu-divider" />
      <div
        class="menu-item"
        @click="detachTab"
      >
        <Icon name="maximize" size="sm" />
        <span class="menu-text">{{ t('tabs.detachToNewWindow') }}</span>
      </div>
    </div>

    <div
      v-if="showSearch"
      class="tab-search-overlay"
      @click.self="toggleSearch"
    >
      <div class="tab-search-modal">
        <input
          ref="searchInput"
          v-model="searchQuery"
          class="tab-search-input"
          :placeholder="t('search.searchPlaceholder')"
          @keydown.enter="handleSearchEnter"
          @keydown.esc="toggleSearch"
        >
        <div class="tab-search-results">
          <div
            v-for="(tabId, index) in filteredTabOrder"
            :key="tabId"
            class="tab-search-result"
            :class="{ active: selectedIndex === index }"
            @click="handleSearchSelect(tabId)"
            @mouseenter="selectedIndex = index"
          >
            <Icon name="file" size="sm" />
            <span class="result-title">{{ getTab(tabId)?.title || t('tabs.untitled') }}</span>
            <span
              v-if="getTab(tabId)?.filePath"
              class="result-path"
            >{{ getTab(tabId)?.filePath }}</span>
          </div>
          <div
            v-if="filteredTabOrder.length === 0"
            class="tab-search-empty"
          >
            {{ t('search.noResults') }}
          </div>
        </div>
      </div>
    </div>
    
    <div
      v-if="draggingTabId"
      class="tab-drag-ghost"
      :style="ghostStyle"
    >
      <span>{{ getTab(draggingTabId)?.title || t('tabs.untitled') }}</span>
    </div>
    
    <div
      v-if="dragOverWindowEdge.direction && windowList.length > 1"
      class="window-edge-indicator"
      :class="dragOverWindowEdge.direction"
    >
      <Icon 
        :name="dragOverWindowEdge.direction === 'left' ? 'chevron-left' : 'chevron-right'" 
        size="lg" 
      />
      <div class="edge-text">
        {{ t('tabs.releaseToMerge') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { t } from '@/services/i18n'
import type { TabState } from '@/types'
import { Icon } from '@/components/Icons'

const tabsStore = useTabsStore()

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  tabId: null as string | null
})

const showSearch = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const selectedIndex = ref(0)

const draggingTabId = ref<string | null>(null)
const dragOverTabId = ref<string | null>(null)
const ghostStyle = ref({ left: '0px', top: '0px' })
const dragOverWindowEdge = ref<{ direction: 'left' | 'right' | null, targetWindowId: number | null }>({ direction: null, targetWindowId: null })
const windowList = ref<Array<{ id: number; title: string }>>([])

const filteredTabOrder = computed(() => {
  if (!searchQuery.value) {
    return tabsStore.tabOrder
  }
  const query = searchQuery.value.toLowerCase()
  return tabsStore.tabOrder.filter((tabId) => {
    const tab = tabsStore.tabs.get(tabId)
    if (!tab) return false
    return (
      tab.title.toLowerCase().includes(query) ||
      (tab.filePath && tab.filePath.toLowerCase().includes(query))
    )
  })
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

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    searchQuery.value = ''
    selectedIndex.value = 0
    nextTick(() => {
      searchInput.value?.focus()
    })
  }
}

function handleSearchEnter() {
  if (filteredTabOrder.value.length > 0) {
    tabsStore.switchTab(filteredTabOrder.value[selectedIndex.value])
    toggleSearch()
  }
}

function handleSearchSelect(tabId: string) {
  tabsStore.switchTab(tabId)
  toggleSearch()
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    toggleSearch()
  }
}

function handleGlobalClick() {
  hideContextMenu()
}

function handleTabClose(tabId: string) {
  const tab = getTab(tabId)
  if (tab?.isDirty) {
    if (!confirm('文件有未保存的更改，确定要关闭吗？')) {
      return
    }
  }
  tabsStore.removeTab(tabId)
}

function handleNewTab() {
  tabsStore.createTab({ title: t('tabs.untitled') })
}

function saveCurrentTab() {
  if (contextMenu.value.tabId) {
    tabsStore.saveFile(contextMenu.value.tabId)
  }
  hideContextMenu()
}

function saveAsCurrentTab() {
  if (contextMenu.value.tabId) {
    tabsStore.saveFileAs(contextMenu.value.tabId)
  }
  hideContextMenu()
}

function closeCurrentTab() {
  if (contextMenu.value.tabId) {
    handleTabClose(contextMenu.value.tabId)
  }
  hideContextMenu()
}

function closeOtherTabs() {
  const activeTabId = tabsStore.activeTabId
  const allTabIds = Array.from(tabsStore.tabs.keys())

  for (const tabId of allTabIds) {
    if (tabId !== activeTabId) {
      const tab = getTab(tabId)
      if (tab?.isDirty) {
        if (!confirm(`文件 "${tab.title}" 有未保存的更改，确定要关闭吗？`)) {
          continue
        }
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

function closeAllTabs() {
  const allTabIds = Array.from(tabsStore.tabs.keys())
  let hasDirtyTab = false

  for (const tabId of allTabIds) {
    const tab = getTab(tabId)
    if (tab?.isDirty) {
      hasDirtyTab = true
      break
    }
  }

  if (hasDirtyTab) {
    if (!confirm('有些文件有未保存的更改，确定要关闭全部吗？')) {
      hideContextMenu()
      return
    }
  }

  // 关闭所有标签页
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

let currentWindowId: number | null = null

async function handleDragStart(event: DragEvent, tabId: string) {
  draggingTabId.value = tabId
  
  if (window.electronAPI) {
    try {
      const idResp = await window.electronAPI.getWindowId()
      if (idResp.success && idResp.data) {
        currentWindowId = idResp.data
      }
      const listResp = await window.electronAPI.listWindows()
      if (listResp.success && listResp.data) {
        windowList.value = listResp.data
      }
    } catch (e) {
      console.error('Failed to get window info:', e)
    }
  }
  
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tabId)
    
    setTimeout(() => {
      if (draggingTabId.value === tabId) {
        ghostStyle.value = {
          left: `${event.clientX}px`,
          top: `${event.clientY}px`
        }
      }
    }, 0)
  }
}

function handleDragEnd() {
  draggingTabId.value = null
  dragOverTabId.value = null
}

function handleDragOver(event: DragEvent, tabId: string) {
  if (draggingTabId.value && draggingTabId.value !== tabId) {
    dragOverTabId.value = tabId
    
    const edgeThreshold = 50
    const direction: 'left' | 'right' | null = 
      event.clientX < edgeThreshold ? 'left' : 
      event.clientX > window.innerWidth - edgeThreshold ? 'right' : null
    
    if (direction) {
      const otherWindows = windowList.value.filter(w => w.id !== currentWindowId)
      if (otherWindows.length > 0) {
        dragOverWindowEdge.value = { direction, targetWindowId: otherWindows[0].id }
      } else {
        dragOverWindowEdge.value = { direction: null, targetWindowId: null }
      }
    } else {
      dragOverWindowEdge.value = { direction: null, targetWindowId: null }
    }
  }
}

function handleDrop(event: DragEvent, targetTabId: string) {
  event.preventDefault()
  
  if (!draggingTabId.value) {
    return
  }
  
  if (dragOverWindowEdge.value.direction && dragOverWindowEdge.value.targetWindowId && window.electronAPI) {
    const tab = getTab(draggingTabId.value)
    if (tab) {
      window.electronAPI.mergeTab({
        id: tab.id,
        title: tab.title,
        content: tab.content,
        filePath: tab.filePath,
        isDirty: tab.isDirty,
        viewMode: tab.viewMode,
        cursor: tab.cursor
      }, dragOverWindowEdge.value.targetWindowId)
      
      tabsStore.removeTab(draggingTabId.value)
    }
  } else if (draggingTabId.value !== targetTabId) {
    const currentOrder = [...tabsStore.tabOrder]
    const dragIndex = currentOrder.indexOf(draggingTabId.value)
    const targetIndex = currentOrder.indexOf(targetTabId)
    
    if (dragIndex > -1 && targetIndex > -1) {
      currentOrder.splice(dragIndex, 1)
      const insertIndex = dragIndex < targetIndex ? targetIndex : targetIndex + 1
      currentOrder.splice(insertIndex > dragIndex ? insertIndex - 1 : insertIndex, 0, draggingTabId.value)
      
      tabsStore.tabOrder = currentOrder
    }
  }
  
  draggingTabId.value = null
  dragOverTabId.value = null
  dragOverWindowEdge.value = { direction: null, targetWindowId: null }
}

function detachTab() {
  const tabId = contextMenu.value.tabId
  if (!tabId) return
  
  const tab = getTab(tabId)
  if (!tab) return
  
  if (window.electronAPI) {
    window.electronAPI.openNewWindow({
      tabData: {
        id: tab.id,
        title: tab.title,
        content: tab.content,
        filePath: tab.filePath ?? null,
        isDirty: tab.isDirty,
        viewMode: tab.viewMode,
        cursor: tab.cursor
      }
    })
    
    tabsStore.removeTab(tabId)
  } else {
    alert('此功能仅在 Electron 环境下可用')
  }
  
  hideContextMenu()
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  document.addEventListener('keydown', handleGlobalKeydown)
  
  // 标签栏横向滚动支持
  const tabsContainer = document.querySelector('.tabs-container') as HTMLElement
  if (tabsContainer) {
    tabsContainer.addEventListener('wheel', (e: WheelEvent) => {
      // 直接横向滚动，无需按住Shift
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

.tab-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1000;
  padding-top: 100px;
}

.tab-search-modal {
  background: var(--sidebar-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 500px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.tab-search-input {
  width: 100%;
  padding: 16px;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  font-size: 16px;
  outline: none;
}

.tab-search-results {
  max-height: 300px;
  overflow-y: auto;
}

.tab-search-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover,
  &.active {
    background: var(--sidebar-hover-bg);
  }
}

.result-title {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.result-path {
  font-size: 12px;
  color: var(--text-secondary);
}

.tab-search-empty {
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
}

.tab-drag-ghost {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  background: var(--tab-active-bg);
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translate(-50%, -50%);
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
</style>
