<template>
  <div class="editor-container">
    <div class="editor-toolbar">
      <div class="toolbar-group">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          class="toolbar-btn"
          :class="{ active: currentMode === mode.value }"
          :title="mode.label"
          @click="handleViewModeChange(mode.value)"
        >
          {{ mode.icon }}
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: prefsStore.typewriterMode }"
          title="打字机模式"
          @click="toggleTypewriterMode"
        >
          ⌨️
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: prefsStore.focusMode }"
          title="专注模式"
          @click="toggleFocusMode"
        >
          🎯
        </button>
      </div>
    </div>
    <div class="editor-content" :class="contentClasses">
      <div
        v-show="currentMode === 'wysiwyg'"
        ref="wysiwygRef"
        class="wysiwyg-editor"
      />
      <textarea
        v-show="currentMode === 'source'"
        ref="sourceRef"
        v-model="sourceContent"
        class="source-editor"
        @input="handleSourceInput"
        @keydown="handleSourceKeydown"
        @scroll="handleSourceScroll"
      />
      <div v-show="currentMode === 'split'" class="split-view">
        <textarea
          ref="splitSourceRef"
          v-model="sourceContent"
          class="split-source"
          @input="handleSourceInput"
          @keydown="handleSourceKeydown"
          @scroll="handleSourceScroll"
        />
        <div ref="splitPreviewRef" class="split-preview" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useEditorManager } from '@/managers/editorManager'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { eventBus, AppEvents } from '@/events/eventBus'
import { debounce } from '@/utils/helpers'
import type { ViewMode } from '@/types'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const wysiwygRef = ref<HTMLElement | null>(null)
const sourceRef = ref<HTMLTextAreaElement | null>(null)
const splitSourceRef = ref<HTMLTextAreaElement | null>(null)
const splitPreviewRef = ref<HTMLElement | null>(null)

const sourceContent = ref('')
let unsubscribes: (() => void)[] = []

const { containerRef, isReady, currentMode, init, setViewMode, destroy, getManager } = useEditorManager()
const { toggleTypewriterMode, toggleFocusMode } = useWritingEnhancement()

const viewModes = [
  { value: 'wysiwyg' as ViewMode, label: 'WYSIWYG 模式', icon: '◉' },
  { value: 'source' as ViewMode, label: '源码模式', icon: '{ }' },
  { value: 'split' as ViewMode, label: '分屏模式', icon: '◈' }
]

const activeTab = computed(() => tabsStore.activeTab)

const contentClasses = computed(() => ({
  [`mode-${currentMode.value}`]: true,
  'typewriter-mode': prefsStore.typewriterMode,
  'focus-mode': prefsStore.focusMode
}))

// 监听标签页内容变化，同步到源码编辑器
const unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, (payload: any) => {
  if (payload && payload.tabId === activeTab.value?.id) {
    sourceContent.value = payload.content
    updatePreview()
  }
})
unsubscribes.push(unsubscribeContentChanged)

// 监听标签页切换
watch(activeTab, (tab) => {
  if (tab) {
    sourceContent.value = tab.content
  }
}, { immediate: true })

const handleViewModeChange = async (mode: ViewMode) => {
  const manager = getManager()

  if (mode !== 'wysiwyg') {
    // 切换到源码或分屏模式时，获取当前WYSIWYG内容同步到源码
    if (manager && manager.isReady()) {
      sourceContent.value = manager.getMarkdown()
    }
  }

  if (mode === 'wysiwyg' && currentMode.value !== 'wysiwyg') {
    // 从源码模式切换回WYSIWYG时，同步源码内容到编辑器
    if (manager && manager.isReady()) {
      await manager.setMarkdown(sourceContent.value)
    }
  }

  setViewMode(mode)
  updatePreview()
}

const handleSourceInput = debounce(() => {
  if (activeTab.value) {
    tabsStore.updateTab(activeTab.value.id, {
      content: sourceContent.value,
      isDirty: true
    })
    updatePreview()
  }
}, 100)

function updatePreview() {
  if ((currentMode.value === 'split') && splitPreviewRef.value) {
    // 简单的Markdown预览（实际项目中可使用marked或其他库）
    let html = sourceContent.value
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/!\[(.*?)\]\((.*?)\)/gim, "<img alt='$1' src='$2' />")
      .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2'>$1</a>")
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br />')

    splitPreviewRef.value.innerHTML = html
  }
}

function handleSourceKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = e.target as HTMLTextAreaElement
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end)
    textarea.selectionStart = textarea.selectionEnd = start + 2
    sourceContent.value = textarea.value
  }
}

function handleSourceScroll(e: Event) {
  if (currentMode.value === 'split') {
    const source = e.target as HTMLTextAreaElement
    if (splitPreviewRef.value) {
      splitPreviewRef.value.scrollTop = source.scrollTop
    }
  }
}

onMounted(async () => {
  if (wysiwygRef.value) {
    containerRef.value = wysiwygRef.value
    await init()
  }
})

onUnmounted(async () => {
  unsubscribes.forEach(unsubscribe => unsubscribe())
  await destroy()
})
</script>

<style scoped lang="scss">
.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--editor-bg);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--border-color);
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 8px;
}

.toolbar-btn {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--toolbar-btn-hover-bg);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}

.editor-content {
  flex: 1;
  overflow: hidden;
  position: relative;

  &.mode-wysiwyg {
    .wysiwyg-editor {
      height: 100%;
      padding: 20px 40px;
      overflow: auto;
      transition: all 0.3s ease;

      :deep(.milkdown) {
        outline: none;
        min-height: 100%;
        max-width: 800px;
        margin: 0 auto;

        p {
          margin: 1em 0;
          line-height: 1.8;
        }

        h1, h2, h3, h4, h5, h6 {
          margin: 1.5em 0 0.5em;
          font-weight: 600;
        }

        h1 {
          font-size: 2rem;
        }

        h2 {
          font-size: 1.75rem;
        }

        h3 {
          font-size: 1.5rem;
        }

        code {
          background: var(--code-bg);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Fira Code', monospace;
        }

        pre {
          background: var(--code-bg);
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;

          code {
            background: none;
            padding: 0;
          }
        }

        blockquote {
          border-left: 4px solid var(--primary-color);
          padding-left: 16px;
          margin: 1em 0;
          color: var(--text-secondary);
        }

        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;

          th, td {
            border: 1px solid var(--border-color);
            padding: 8px 12px;
          }

          th {
            background: var(--table-header-bg);
          }
        }

        .focus-highlight {
          background: rgba(59, 130, 246, 0.1);
          border-radius: 4px;
          transition: all 0.3s ease;
        }
      }
    }
  }

  &.mode-source {
    .source-editor {
      width: 100%;
      height: 100%;
      padding: 20px 40px;
      border: none;
      outline: none;
      resize: none;
      background: var(--editor-bg);
      color: var(--editor-text);
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 14px;
      line-height: 1.6;
    }
  }

  &.mode-split {
    .split-view {
      display: flex;
      height: 100%;

      .split-source {
        width: 50%;
        height: 100%;
        padding: 20px;
        border: none;
        border-right: 1px solid var(--border-color);
        outline: none;
        resize: none;
        background: var(--editor-bg);
        color: var(--editor-text);
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 14px;
        line-height: 1.6;
      }

      .split-preview {
        width: 50%;
        height: 100%;
        padding: 20px;
        overflow: auto;
        background: var(--preview-bg);

        h1, h2, h3 {
          margin: 1em 0 0.5em;
        }

        p {
          margin: 0.5em 0;
        }

        code {
          background: var(--code-bg);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Fira Code', monospace;
        }
      }
    }
  }

  &.typewriter-mode {
    .wysiwyg-editor, .source-editor, .split-source {
      scroll-behavior: smooth;
    }
  }

  &.focus-mode {
    .wysiwyg-editor, .source-editor {
      background: var(--bg-primary);
    }
  }
}
</style>
