<template>
  <div class="status-bar">
    <div class="status-left">
      <button
        class="status-btn sidebar-toggle"
        :title="t('statusBar.toggleSidebar')"
        @click="toggleSidebar"
      >
        <Icon
          :name="prefsStore.showSidebar ? 'collapse-left' : 'expand-right'"
          size="sm"
        />
      </button>
      <span
        v-if="activeTab"
        class="status-item"
        :title="activeTab.viewMode === 'wysiwyg' ? t('editor.wysiwygMode') : activeTab.viewMode === 'source' ? t('editor.sourceMode') : t('editor.splitMode')"
      >
        <Icon
          :name="activeTab.viewMode === 'wysiwyg' ? 'wysiwyg' : activeTab.viewMode === 'source' ? 'code' : 'split'"
          size="sm"
        />
      </span>
      <span
        v-if="activeTab?.filePath"
        class="status-item file-path"
        :title="activeTab.filePath"
      >
        <Icon
          name="file"
          size="sm"
        />
        <span class="file-path-text">{{ fileName }}</span>
      </span>
      <span
        v-if="activeTab?.isDirty"
        class="status-item dirty-indicator"
        :title="t('common.unsavedChanges')"
      >
        ●
      </span>
    </div>
    <div class="status-right">
      <span
        class="status-item"
        :title="t('editor.rawMarkdownChars')"
      >
        <Icon
          name="file"
          size="sm"
        />
        <span>{{ rawMarkdownChars }}</span>
      </span>
      <span
        class="status-item"
        :title="t('statusBar.renderTextCount')"
      >
        <Icon
          name="wysiwyg"
          size="sm"
        />
        <span>{{ plainTextChars }}</span>
      </span>
      <span
        class="status-item"
        :title="t('editor.lineCount')"
      >
        <span>{{ lineCount }}Ln</span>
      </span>
      <span
        class="status-item"
        :title="t('editor.cursorPosition')"
      >
        <span>{{ cursorPosition }}</span>
      </span>
      <button
        class="status-btn"
        :class="{ active: prefsStore.typewriterMode }"
        :title="t('editor.typewriterMode')"
        @click="toggleTypewriterMode"
      >
        <Icon
          name="typewriter"
          size="sm"
        />
      </button>
      <button
        class="status-btn"
        :class="{ active: prefsStore.focusMode }"
        :title="t('editor.focusMode')"
        @click="toggleFocusMode"
      >
        <Icon
          name="target"
          size="sm"
        />
      </button>
      <button
        class="status-btn"
        :title="t('statusBar.switchTheme')"
        @click="prefsStore.toggleTheme()"
      >
        <Icon
          :name="prefsStore.theme === 'light' || prefsStore.theme === 'system' ? 'moon' : 'sun'"
          size="sm"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const activeTab = computed(() => tabsStore.activeTab)

// 仅显示文件名，不显示完整路径
const fileName = computed(() => {
  if (!activeTab.value?.filePath) return ''
  return activeTab.value.filePath.split(/[/\\]/).pop() || activeTab.value.filePath
})

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
  if (!activeTab.value) return '1:1'
  const content = activeTab.value.content.substring(0, activeTab.value.cursor.from)
  const lines = content.split('\n')
  const line = lines.length
  const col = lines[lines.length - 1].length + 1
  return `${line}:${col}`
})

function toggleSidebar() {
  prefsStore.showSidebar = !prefsStore.showSidebar
}

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
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;

  &.file-path {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    .file-path-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &.dirty-indicator {
    color: var(--primary-color);
    font-size: 14px;
    font-weight: bold;
  }
}

.status-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
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

  &.sidebar-toggle {
    padding: 2px 4px;
    margin-left: -4px;
  }
}
</style>
