<template>
  <div class="status-bar">
    <div class="status-left">
      <span v-if="activeTab" class="status-item">
        {{ activeTab.viewMode === 'wysiwyg' ? 'WYSIWYG' : activeTab.viewMode === 'source' ? '源码' : '分屏' }}
      </span>
      <span v-if="activeTab?.filePath" class="status-item file-path">
        {{ activeTab.filePath }}
      </span>
      <span v-if="activeTab?.isDirty" class="status-item dirty-indicator">
        ● 已修改
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
        {{ prefsStore.theme === 'light' || prefsStore.theme === 'system' ? '🌙' : '☀️' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, Ref, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'

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

let unsubscribeTabSwitched: (() => void) | null = null
let unsubscribeTabUpdated: (() => void) | null = null
let unsubscribeContentChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeTabSwitched = eventBus.on(AppEvents.TAB_SWITCHED, ({ tabId }) => {
    console.log('[StatusBar] Tab switched to:', tabId)
  })

  unsubscribeTabUpdated = eventBus.on(AppEvents.TAB_UPDATED, ({ tabId, updates }) => {
    if (updates.isDirty !== undefined) {
      console.log('[StatusBar] Tab dirty status changed:', tabId, updates.isDirty)
    }
  })

  unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, ({ tabId }) => {
    console.log('[StatusBar] Content changed in tab:', tabId)
  })
})

onUnmounted(() => {
  unsubscribeTabSwitched?.()
  unsubscribeTabUpdated?.()
  unsubscribeContentChanged?.()
})
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

  &.dirty-indicator {
    color: var(--primary-color);
    font-size: 10px;
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
