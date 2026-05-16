<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <div
        v-for="tabId in tabsStore.tabOrder"
        :key="tabId"
        class="tab-item"
        :class="{ active: tabId === tabsStore.activeTabId, dirty: getTab(tabId)?.isDirty }"
        @click="handleTabClick(tabId)"
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
  </div>
</template>

<script setup lang="ts">
import { useTabsStore } from '@/stores/tabs'
import type { TabState } from '@/types'

const tabsStore = useTabsStore()

function getTab(tabId: string): TabState | undefined {
  return tabsStore.tabs.get(tabId)
}

function handleTabClick(tabId: string) {
  tabsStore.switchTab(tabId)
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
</script>

<style scoped lang="scss">
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--tab-bar-bg);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
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
</style>
