<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <div
        v-for="tabId in filteredTabOrder"
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
        class="search-btn"
        title="搜索标签 (Ctrl+P)"
        @click="toggleSearch"
      >
        <Icon
          name="search"
          size="sm"
        />
      </button>
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
            <Icon
              name="file"
              size="sm"
            />
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
    
    <Teleport to="body">
      <div
        v-if="dragState.sourceTabId"
        class="tab-drag-ghost"
        :style="ghostStyle"
      >
        <span>{{ getTab(dragState.sourceTabId)?.title || t('tabs.untitled') }}</span>
      </div>
    </Teleport>
    
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { t } from '@/services/i18n'
import type { TabState } from '@/types'
import { Icon } from '@/components/Icons'

type DragTargetType = 'none' | 'tab' | 'windowEdge' | 'outsideWindow'

interface DragState {
  sourceTabId: string | null
  targetType: DragTargetType
  targetTabId: string | null
  targetWindowId: number | null
  windowEdgeDirection: 'left' | 'right' | null
  insertIndex: number
  mousePosition: { x: number, y: number }
}

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

const dragState = reactive<DragState>({
  sourceTabId: null,
  targetType: 'none',
  targetTabId: null,
  targetWindowId: null,
  windowEdgeDirection: null,
  insertIndex: -1,
  mousePosition: { x: 0, y: 0 }
})

const windowList = ref<Array<{ id: number; title: string }>>([])
let currentWindowId: number | null = null
let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null
let hasDroppedOnTab = false

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

const ghostStyle = computed(() => ({
  left: `${dragState.mousePosition.x}px`,
  top: `${dragState.mousePosition.y}px`
}))

function getTab(tabId: string): TabState | undefined {
  return tabsStore.tabs.get(tabId)
}

function getCurrentTab(): TabState | undefined {
  if (contextMenu.value.tabId) {
    return getTab(contextMenu.value.tabId)
  }
  return undefined
}

function resetDragState() {
  dragState.sourceTabId = null
  dragState.targetType = 'none'
  dragState.targetTabId = null
  dragState.targetWindowId = null
  dragState.windowEdgeDirection = null
  dragState.insertIndex = -1
  hasDroppedOnTab = false
}

async function refreshWindowList() {
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
  tabsStore.createTab()
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

async function handleDragStart(event: DragEvent, tabId: string) {
  dragState.sourceTabId = tabId
  dragState.targetType = 'none'
  dragState.targetTabId = null
  dragState.targetWindowId = null
  dragState.windowEdgeDirection = null
  hasDroppedOnTab = false
  
  await refreshWindowList()
  
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tabId)
    
    setTimeout(() => {
      if (dragState.sourceTabId === tabId) {
        dragState.mousePosition = {
          x: event.clientX,
          y: event.clientY
        }
      }
    }, 0)
  }
}

function updateWindowEdgeState(event: DragEvent) {
  if (!dragState.sourceTabId) return
  
  const edgeThreshold = 50
  const direction: 'left' | 'right' | null = 
    event.clientX < edgeThreshold ? 'left' : 
    event.clientX > window.innerWidth - edgeThreshold ? 'right' : null
  
  if (direction) {
    const otherWindows = windowList.value.filter(w => w.id !== currentWindowId)
    if (otherWindows.length > 0) {
      dragState.targetType = 'windowEdge'
      dragState.windowEdgeDirection = direction
      dragState.targetWindowId = otherWindows[0].id
      return
    }
  }
  
  dragState.targetType = 'none'
  dragState.windowEdgeDirection = null
  dragState.targetWindowId = null
}

function isMouseOutsideWindow(event: DragEvent): boolean {
  return (
    event.clientX < 0 ||
    event.clientX > window.innerWidth ||
    event.clientY < 0 ||
    event.clientY > window.innerHeight
  )
}

function handleDragEnter(event: DragEvent, tabId: string) {
  if (!dragState.sourceTabId || dragState.sourceTabId === tabId) return
  
  if (dragLeaveTimer) {
    clearTimeout(dragLeaveTimer)
    dragLeaveTimer = null
  }
  
  dragState.targetTabId = tabId
  dragState.targetType = 'tab'
  dragState.windowEdgeDirection = null
  dragState.targetWindowId = null
}

function handleDragOver(event: DragEvent, tabId: string) {
  if (!dragState.sourceTabId) return
  
  dragState.mousePosition = {
    x: event.clientX,
    y: event.clientY
  }
  
  if (dragState.sourceTabId === tabId) return
  
  const isOutside = isMouseOutsideWindow(event)
  
  if (isOutside) {
    if (dragState.targetType !== 'outsideWindow') {
      dragState.targetType = 'outsideWindow'
      dragState.targetTabId = null
      dragState.windowEdgeDirection = null
      dragState.targetWindowId = null
    }
    return
  }
  
  updateWindowEdgeState(event)
  
  if (dragState.targetType === 'none') {
    dragState.targetTabId = tabId
    dragState.targetType = 'tab'
  }
}

function handleDragLeave(event: DragEvent) {
  if (!dragState.sourceTabId) return
  
  const relatedTarget = event.relatedTarget as HTMLElement | null
  const tabBar = document.querySelector('.tab-bar')
  
  if (relatedTarget && tabBar?.contains(relatedTarget)) {
    return
  }
  
  dragLeaveTimer = setTimeout(() => {
    if (dragState.targetType === 'tab') {
      dragState.targetTabId = null
      dragState.targetType = 'none'
    }
  }, 50)
}

function handleDrop(event: DragEvent, targetTabId: string) {
  event.preventDefault()
  
  if (!dragState.sourceTabId || dragState.sourceTabId === targetTabId) {
    return
  }
  
  if (dragState.targetType !== 'tab') {
    return
  }
  
  hasDroppedOnTab = true
  
  const currentOrder = [...tabsStore.tabOrder]
  const dragIndex = currentOrder.indexOf(dragState.sourceTabId)
  const targetIndex = currentOrder.indexOf(targetTabId)
  
  if (dragIndex === -1 || targetIndex === -1) {
    return
  }
  
  currentOrder.splice(dragIndex, 1)
  
  let insertIndex = targetIndex
  if (dragIndex < targetIndex) {
    insertIndex = targetIndex
  } else {
    insertIndex = targetIndex
  }
  
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  const isAfterMiddle = event.clientX > rect.left + rect.width / 2
  
  if (isAfterMiddle && dragIndex > targetIndex) {
    insertIndex = targetIndex + 1
  } else if (!isAfterMiddle && dragIndex < targetIndex) {
    insertIndex = targetIndex - 1
  } else if (isAfterMiddle) {
    insertIndex = targetIndex + 1
  }
  
  insertIndex = Math.max(0, Math.min(insertIndex, currentOrder.length))
  
  currentOrder.splice(insertIndex > dragIndex ? insertIndex - 1 : insertIndex, 0, dragState.sourceTabId)
  
  const newDragIndex = currentOrder.indexOf(dragState.sourceTabId)
  if (newDragIndex !== insertIndex) {
    currentOrder.splice(newDragIndex, 1)
    currentOrder.splice(insertIndex, 0, dragState.sourceTabId)
  }
  
  tabsStore.tabOrder = currentOrder
}

async function handleDragEnd(event: DragEvent) {
  if (!dragState.sourceTabId) {
    resetDragState()
    return
  }
  
  const tab = getTab(dragState.sourceTabId)
  if (!tab) {
    resetDragState()
    return
  }
  
  if (hasDroppedOnTab) {
    resetDragState()
    return
  }
  
  if (dragState.targetType === 'windowEdge' && dragState.targetWindowId && window.electronAPI) {
    window.electronAPI.mergeTab({
      id: tab.id,
      title: tab.title,
      content: tab.content,
      filePath: tab.filePath,
      isDirty: tab.isDirty,
      viewMode: tab.viewMode,
      cursor: tab.cursor
    }, dragState.targetWindowId)
    
    tabsStore.removeTab(dragState.sourceTabId)
  } else if (dragState.targetType === 'outsideWindow' || isMouseOutsideWindow(event)) {
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
      
      tabsStore.removeTab(dragState.sourceTabId)
    }
  }
  
  resetDragState()
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
  if (dragLeaveTimer) {
    clearTimeout(dragLeaveTimer)
  }
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
</style>

<style>
.tab-drag-ghost {
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
