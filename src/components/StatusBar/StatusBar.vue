<template>
  <div class="status-bar">
    <div class="status-left">
      <span v-if="activeTab" class="status-item">
        {{ activeTab.viewMode === 'wysiwyg' ? 'WYSIWYG' : activeTab.viewMode === 'source' ? '源码' : '分屏' }}
      </span>
      <span v-if="activeTab?.filePath" class="status-item file-path">
        {{ activeTab.filePath }}
      </span>
    </div>
    <div class="status-right">
      <span class="status-item">{{ wordCount }} 字</span>
      <span class="status-item">{{ lineCount }} 行</span>
      <span class="status-item">{{ cursorPosition }}</span>
      <button
        class="status-btn"
        :class="{ active: prefsStore.typewriterMode }"
        title="打字机模式"
        @click="toggleTypewriterMode"
      >
        打字机
      </button>
      <button
        class="status-btn"
        :class="{ active: prefsStore.focusMode }"
        title="专注模式"
        @click="toggleFocusMode"
      >
        专注
      </button>
      <button
        class="status-btn"
        @click="prefsStore.toggleTheme()"
        title="切换主题"
      >
        {{ prefsStore.theme === 'light' ? '🌙' : '☀️' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, Ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const isFullscreen = inject<Ref<boolean>>('isFullscreen')

const activeTab = computed(() => tabsStore.activeTab)

const wordCount = computed(() => {
  if (!activeTab.value?.content) return 0
  return activeTab.value.content.replace(/\s/g, '').length
})

const lineCount = computed(() => {
  if (!activeTab.value?.content) return 0
  return activeTab.value.content.split('\n').length
})

const cursorPosition = computed(() => {
  if (!activeTab.value) return 'Ln 1, Col 1'
  const content = activeTab.value.content.substring(0, activeTab.value.cursor.from)
  const lines = content.split('\n')
  const line = lines.length
  const col = lines[lines.length - 1].length + 1
  return `Ln ${line}, Col ${col}`
})

function toggleTypewriterMode() {
  prefsStore.setTypewriterMode(!prefsStore.typewriterMode)
}

function toggleFocusMode() {
  prefsStore.setFocusMode(!prefsStore.focusMode)
}
</script>

<style scoped lang="scss">
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  background: var(--statusbar-bg);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  
  &.file-path {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.status-btn {
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--statusbar-hover-bg);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}
</style>
