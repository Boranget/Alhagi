<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <div
        v-for="tabId in tabsStore.tabOrder"
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
    <button class="new-tab-btn" @click="handleNewTab">+</button>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import type { TabState } from '@/types'

const tabsStore = useTabsStore()

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
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
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
</style>
