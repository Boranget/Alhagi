<template>
  <div class="menu-bar">
    <div class="menu-items">
      <div
        v-for="group in menuGroups"
        :key="group.category"
        class="menu-item"
        :class="{ active: activeMenu === group.category }"
        @click="toggleMenu(group.category)"
        @mouseenter="hoverMenu(group.category)"
      >
        <span class="menu-label">{{ getCategoryLabel(group.category) }}</span>
        <MenuDropdown
          v-if="activeMenu === group.category"
          :category="group.category"
          :commands="group.commands"
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
import { t } from '@/services/i18n'
import MenuDropdown from './MenuDropdown.vue'
import type { CommandCategory, CommandEntry } from '@/commands/types'

const activeMenu = ref<CommandCategory | null>(null)

// 将 Map 转换为数组形式，避免在模板 v-for 中遍历 Map 引发的类型/键序歧义
const menuGroups = computed<Array<{ category: CommandCategory; commands: CommandEntry[] }>>(() => {
  const grouped = getGroupedMenuCommands()
  return Array.from(grouped.entries()).map(([category, commands]) => ({
    category,
    commands,
  }))
})

function getCategoryLabel(category: CommandCategory): string {
  // CATEGORY_LABELS 的值已经是 i18n key（'menu.category.<cat>'），统一走 t() 翻译
  return t(CATEGORY_LABELS[category] || category)
}

function toggleMenu(category: CommandCategory) {
  if (activeMenu.value === category) {
    activeMenu.value = null
  } else {
    activeMenu.value = category
  }
}

function hoverMenu(category: CommandCategory) {
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
