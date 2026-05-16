<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <div
        v-for="tabId in filteredTabOrder"
        :key="tabId"
        class="tab-item"
        :class="{ active: tabId === tabsStore.activeTabId, dirty: getTab(tabId)?.isDirty }"
        @click="handleTabClick(tabId)"
        @contextmenu.prevent="showContextMenu($event, tabId)"
        @mousedown.middle="handleTabClose(tabId)"
      >
        <span class="tab-title">{{ getTab(tabId)?.title || '未命名' }}</span>
        <button
          v-if="tabsStore.tabCount > 1 || getTab(tabId)?.isDirty"
          class="tab-close"
          @click.stop="handleTabClose(tabId)"
        >
          <span v-if="getTab(tabId)?.isDirty" class="dirty-indicator">●</span>
          <span v-else>×</span>
        </button>
      </div>
    </div>
    <div class="tab-actions">
      <button class="search-btn" @click="toggleSearch" title="搜索标签 (Ctrl+P)">
        🔍
      </button>
      <button class="new-tab-btn" @click="handleNewTab">+</button>
    </div>

    <div
      v-if="contextMenu.show"
      class="tab-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div class="menu-item" @click="saveCurrentTab">
        <span class="menu-icon">💾</span>
        <span class="menu-text">保存</span>
      </div>
      <div class="menu-item" @click="saveAsCurrentTab">
        <span class="menu-icon">📄</span>
        <span class="menu-text">另存为</span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="closeCurrentTab">
        <span class="menu-icon">✕</span>
        <span class="menu-text">关闭</span>
      </div>
      <div class="menu-item" @click="closeOtherTabs">
        <span class="menu-icon">📑</span>
        <span class="menu-text">关闭其他</span>
      </div>
      <div class="menu-item" @click="closeSavedTabs">
        <span class="menu-icon">📂</span>
        <span class="menu-text">关闭已保存</span>
      </div>
      <div class="menu-item" @click="closeAllTabs">
        <span class="menu-icon">🗑️</span>
        <span class="menu-text">关闭全部</span>
      </div>
      <div class="menu-divider" v-if="getCurrentTab()?.filePath"></div>
      <div class="menu-item" @click="copyFilePath" v-if="getCurrentTab()?.filePath">
        <span class="menu-icon">📋</span>
        <span class="menu-text">复制路径</span>
      </div>
    </div>

    <div v-if="showSearch" class="tab-search-overlay" @click.self="toggleSearch">
      <div class="tab-search-modal">
        <input
          v-model="searchQuery"
          class="tab-search-input"
          placeholder="搜索标签..."
          ref="searchInput"
          @keydown.enter="handleSearchEnter"
          @keydown.esc="toggleSearch"
        />
        <div class="tab-search-results">
          <div
            v-for="(tabId, index) in filteredTabOrder"
            :key="tabId"
            class="tab-search-result"
            :class="{ active: selectedIndex === index }"
            @click="handleSearchSelect(tabId)"
            @mouseenter="selectedIndex = index"
          >
            <span class="result-icon">📄</span>
            <span class="result-title">{{ getTab(tabId)?.title || '未命名' }}</span>
            <span v-if="getTab(tabId)?.filePath" class="result-path">{{ getTab(tabId)?.filePath }}</span>
          </div>
          <div v-if="filteredTabOrder.length === 0" class="tab-search-empty">
            没有找到匹配的标签
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import type { TabState } from '@/types'

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
  tabsStore.createTab({ title: '未命名' })
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
        if (!confirm(`文件 \"${tab.title}\" 有未保存的更改，确定要关闭吗？`)) {
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

  if (allTabIds.length > 0) {
    const lastTabId = allTabIds[allTabIds.length - 1]
    const lastTab = tabsStore.tabs.get(lastTabId)!
    lastTab.content = ''
    lastTab.isDirty = false
    lastTab.filePath = null
    lastTab.title = '未命名'

    for (let i = 0; i < allTabIds.length - 1; i++) {
      tabsStore.removeTab(allTabIds[i])
    }

    tabsStore.switchTab(lastTabId)
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

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  document.addEventListener('keydown', handleGlobalKeydown)
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
  font-size: 16px;
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
  font-size: 20px;
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

.menu-icon {
  font-size: 14px;
  width: 20px;
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

.result-icon {
  font-size: 18px;
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
