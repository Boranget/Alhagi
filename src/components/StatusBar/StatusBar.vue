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
      <button
        v-if="isEditorFile"
        class="status-btn mode-toggle"
        :title="activeTab?.viewMode === 'wysiwyg' ? t('editor.wysiwygMode') : activeTab?.viewMode === 'source' ? t('editor.sourceMode') : t('editor.splitMode')"
        @click="toggleViewMode"
      >
        <Icon
          :name="activeTab?.viewMode === 'wysiwyg' ? 'wysiwyg' : activeTab?.viewMode === 'source' ? 'code' : 'split'"
          size="sm"
        />
      </button>
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
        v-if="isEditorFile"
        class="status-item word-count-display"
        :title="prefsStore.wordCountDisplayType === 'raw' ? t('editor.rawMarkdownChars') : t('statusBar.renderTextCount')"
        @click="prefsStore.toggleWordCountDisplayType()"
      >
        <Icon
          :name="prefsStore.wordCountDisplayType === 'raw' ? 'file' : 'wysiwyg'"
          size="sm"
        />
        <span>{{ currentWordCount }}</span>
      </span>

      <button
        v-if="isEditorFile"
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
        v-if="isEditorFile"
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
        :class="{ active: isDarkMode }"
        :title="t('statusBar.switchTheme')"
        @click="prefsStore.toggleLightDark()"
      >
        <Icon
          :name="isDarkMode ? 'sun' : 'moon'"
          size="sm"
        />
      </button>
      
      <span
        class="status-item zoom-display"
        :title="t('statusBar.zoomLevel')"
      >
        <Icon
          name="zoom-in"
          size="sm"
        />
        <span>{{ prefsStore.zoom }}%</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { eventBus, AppEvents } from '@/events/eventBus'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const { toggleFocusMode, toggleTypewriterMode } = useWritingEnhancement()

const activeTab = computed(() => tabsStore.activeTab)
const isEditorFile = computed(() => activeTab.value?.fileType === 'editor')

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

// 当前显示的字数统计
const currentWordCount = computed(() => {
  return prefsStore.wordCountDisplayType === 'raw' ? rawMarkdownChars.value : plainTextChars.value
})

const isDarkMode = computed(() => {
  if (prefsStore.theme === 'dark') return true
  if (prefsStore.theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  }
  return false
})

function toggleSidebar() {
  prefsStore.showSidebar = !prefsStore.showSidebar
}

/**
 * 切换编辑器视图模式：wysiwyg -> source -> split -> wysiwyg
 */
function toggleViewMode() {
  if (!activeTab.value) return
  
  const currentMode = activeTab.value.viewMode
  let nextMode: 'wysiwyg' | 'source' | 'split'
  
  // 循环切换：wysiwyg -> source -> split -> wysiwyg
  if (currentMode === 'wysiwyg') {
    nextMode = 'source'
  } else if (currentMode === 'source') {
    nextMode = 'split'
  } else {
    nextMode = 'wysiwyg'
  }
  
  // 触发视图模式切换事件
  eventBus.emit(AppEvents.VIEW_MODE_CHANGED, nextMode)
}

let unsubscribeTabSwitched: (() => void) | null = null
let unsubscribeTabUpdated: (() => void) | null = null
let unsubscribeContentChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeTabSwitched = eventBus.on(AppEvents.TAB_SWITCHED, (payload) => {
    // Tab switched handler
  })

  unsubscribeTabUpdated = eventBus.on(AppEvents.TAB_UPDATED, (payload) => {
    const data = payload as { tabId: string; updates: Record<string, unknown> }
    if (data.updates.isDirty !== undefined) {
      // Dirty status updated
    }
  })

  unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, (payload) => {
    // Content changed handler
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

  &.word-count-display {
    cursor: pointer;
    user-select: none;
    transition: all 0.15s;

    &:hover {
      background: var(--statusbar-hover-bg);
      color: var(--text-primary);
      border-radius: 4px;
      padding: 2px 6px;
      margin: -2px -6px;
    }
  }

  &.zoom-display {
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.15s;

    &:hover {
      background: var(--statusbar-hover-bg);
      color: var(--text-primary);
    }
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

  &.mode-toggle {
    // 模式切换按钮特殊样式
    &:hover {
      background: var(--primary-color);
      color: white;
    }
  }
}
</style>
