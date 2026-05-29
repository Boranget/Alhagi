<template>
  <div class="menu-bar">
    <div class="menu-items">
      <div
        v-for="(commands, category) in menuGroups"
        :key="category"
        class="menu-item"
        :class="{ active: activeMenu === category }"
        @click="toggleMenu(category)"
        @mouseenter="hoverMenu(category)"
      >
        <span class="menu-label">{{ getCategoryLabel(category) }}</span>
        <MenuDropdown
          v-if="activeMenu === category"
          :category="category"
          :commands="commands"
          @close="closeMenus"
        />
      </div>
    </div>
    <div class="menu-bar-actions">
      <button
        class="menu-action-btn"
        title="命令面板 (Ctrl+Shift+P)"
        @click="openCommandPalette"
      >
        <span class="action-icon">⌘</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getGroupedMenuCommands, CATEGORY_LABELS } from '@/commands/registry'
import MenuDropdown from './MenuDropdown.vue'
import type { CommandCategory } from '@/commands/types'

const activeMenu = ref<string | null>(null)

const menuGroups = computed(() => {
  const grouped = getGroupedMenuCommands()
  return grouped
})

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as CommandCategory] || category
}

function toggleMenu(category: string) {
  if (activeMenu.value === category) {
    activeMenu.value = null
  } else {
    activeMenu.value = category
  }
}

function hoverMenu(category: string) {
  if (activeMenu.value !== null) {
    activeMenu.value = category
  }
}

function closeMenus() {
  activeMenu.value = null
}

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('app:quickOpen'))
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.menu-bar')) {
    closeMenus()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMenus()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.menu-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 30px;
  background: var(--bg-secondary, #252526);
  border-bottom: 1px solid var(--border-color, #3a3a3a);
  padding: 0 8px;
  user-select: none;
  -webkit-app-region: drag;
}

.menu-items {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.menu-item {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.menu-item:hover,
.menu-item.active {
  background: var(--bg-hover, #2a2d2e);
}

.menu-label {
  font-size: 13px;
  color: var(--text-primary, #cccccc);
}

.menu-bar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.menu-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #808080);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.menu-action-btn:hover {
  background: var(--bg-hover, #2a2d2e);
  color: var(--text-primary, #cccccc);
}

.action-icon {
  font-size: 14px;
}
</style>
