<template>
  <div class="status-bar">
    <div class="status-left">
      <span
        v-if="activeTab"
        class="status-item"
      >
        {{ activeTab.viewMode === 'wysiwyg' ? 'WYSIWYG' : activeTab.viewMode === 'source' ? '源码' : '分屏' }}
      </span>
      <span
        v-if="activeTab?.filePath"
        class="status-item file-path"
      >
        {{ activeTab.filePath }}
      </span>
      <span
        v-if="activeTab?.isDirty"
        class="status-item dirty-indicator"
      >
        ● 已修改
      </span>
    </div>
    <div class="status-right">
      <span
        class="status-item"
        title="原始 Markdown 字符数（不含空白）"
      >MD: {{ rawMarkdownChars }} 字</span>
      <span
        class="status-item"
        title="渲染后纯文本字符数"
      >文本: {{ plainTextChars }} 字</span>
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
        title="切换主题"
        @click="prefsStore.toggleTheme()"
      >
        {{ prefsStore.theme === 'light' || prefsStore.theme === 'system' ? '🌙' : '☀️' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const activeTab = computed(() => tabsStore.activeTab)

// 原始 Markdown 字符数（不含空白）
const rawMarkdownChars = computed(() => {
  if (!activeTab.value?.content) return 0
  return activeTab.value.content.replace(/\s/g, '').length
})

// 渲染后纯文本字符数（移除 Markdown 语法）
const plainTextChars = computed(() => {
  if (!activeTab.value?.content) return 0
  let text = activeTab.value.content
  // 移除 Markdown 语法
  text = text.replace(/[#*_~`]+/g, '') // 移除 # * _ ~ `
  text = text.replace(/\[.*?\]\(.*?\)/g, '') // 移除链接
  text = text.replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
  text = text.replace(/```[\s\S]*?```/g, '') // 移除代码块
  text = text.replace(/^>\s*/gm, '') // 移除引用标记
  text = text.replace(/^[-*+]\s+/gm, '') // 移除列表标记
  text = text.replace(/\s/g, '') // 移除空白
  return text.length
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
  prefsStore.typewriterMode = !prefsStore.typewriterMode
}

function toggleFocusMode() {
  prefsStore.focusMode = !prefsStore.focusMode
}

let unsubscribeTabSwitched: (() => void) | null = null
let unsubscribeTabUpdated: (() => void) | null = null
let unsubscribeContentChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeTabSwitched = eventBus.on(AppEvents.TAB_SWITCHED, (payload) => {
    const data = payload as { tabId: string; previousTabId?: string }
    console.log('[StatusBar] Tab switched to:', data.tabId)
  })

  unsubscribeTabUpdated = eventBus.on(AppEvents.TAB_UPDATED, (payload) => {
    const data = payload as { tabId: string; updates: Record<string, unknown> }
    if (data.updates.isDirty !== undefined) {
      console.log('[StatusBar] Tab dirty status changed:', data.tabId, data.updates.isDirty)
    }
  })

  unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, (payload) => {
    const data = payload as { content: string; tabId: string }
    console.log('[StatusBar] Content changed in tab:', data.tabId)
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
