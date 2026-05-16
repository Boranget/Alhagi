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
          @click="setViewMode(mode.value)"
        >
          {{ mode.icon }}
        </button>
      </div>
    </div>
    <div class="editor-content" :class="`mode-${currentMode}`">
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
import { useEditorManager } from '@/managers/editorManager'
import { debounce } from '@/utils/helpers'
import type { ViewMode } from '@/types'

const tabsStore = useTabsStore()

const wysiwygRef = ref<HTMLElement | null>(null)
const sourceRef = ref<HTMLTextAreaElement | null>(null)
const splitSourceRef = ref<HTMLTextAreaElement | null>(null)
const splitPreviewRef = ref<HTMLElement | null>(null)

const sourceContent = ref('')

const { containerRef, isReady, currentMode, init, setViewMode, destroy } = useEditorManager()

const viewModes = [
  { value: 'wysiwyg' as ViewMode, label: 'WYSIWYG 模式', icon: '◉' },
  { value: 'source' as ViewMode, label: '源码模式', icon: '{ }' },
  { value: 'split' as ViewMode, label: '分屏模式', icon: '◈' }
]

const activeTab = computed(() => tabsStore.activeTab)

// 同步 sourceContent 与 tab.content
watch(activeTab, (tab) => {
  if (tab) {
    sourceContent.value = tab.content
  }
}, { immediate: true })

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
  if (currentMode.value === 'split' && splitPreviewRef.value) {
    splitPreviewRef.value.innerHTML = sourceContent.value
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
  // 设置容器引用
  if (wysiwygRef.value) {
    containerRef.value = wysiwygRef.value
    await init()
  }
})

onUnmounted(async () => {
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

  &.mode-wysiwyg {
    .wysiwyg-editor {
      height: 100%;
      padding: 20px 40px;
      overflow: auto;

      :deep(.milkdown) {
        outline: none;
        min-height: 100%;

        p {
          margin: 1em 0;
        }

        h1, h2, h3, h4, h5, h6 {
          margin: 1.5em 0 0.5em;
          font-weight: 600;
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
      }
    }
  }
}
</style>
