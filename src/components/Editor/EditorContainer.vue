<template>
  <div class="editor-container">
    <FloatingSearch ref="floatingSearchRef" />
    <div
      v-if="showEditorToolbar"
      class="editor-toolbar"
    >
      <div class="toolbar-group">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          class="toolbar-btn"
          :class="{ active: currentMode === mode.value }"
          :title="mode.label"
          @click="handleViewModeChange(mode.value)"
        >
          <Icon
            :name="mode.icon"
            size="sm"
          />
        </button>
      </div>
      <div class="toolbar-divider" />
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: prefsStore.typewriterMode }"
          :title="t('editor.typewriterMode')"
          @click="toggleTypewriterMode"
        >
          ⌨️
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: prefsStore.focusMode }"
          :title="t('editor.focusMode')"
          @click="toggleFocusMode"
        >
          🎯
        </button>
      </div>
    </div>
    <div
      class="editor-content"
      :class="contentClasses"
    >
      <div
        v-show="currentMode === EDITOR.VIEW_MODES.WYSIWYG"
        ref="crepeContainer"
        class="wysiwyg-editor"
      />
      <textarea
        v-show="currentMode === EDITOR.VIEW_MODES.SOURCE"
        ref="sourceRef"
        v-model="sourceContent"
        class="source-editor"
        @input="handleSourceInput"
        @keydown="handleSourceKeydown"
        @scroll="handleSourceScroll"
      />
      <div
        v-show="currentMode === EDITOR.VIEW_MODES.SPLIT"
        class="split-view"
      >
        <textarea
          ref="splitSourceRef"
          v-model="sourceContent"
          class="split-source"
          @input="handleSourceInput"
          @keydown="handleSourceKeydown"
          @scroll="handleSourceScroll"
        />
        <div
          ref="splitPreviewRef"
          class="split-preview"
          @scroll="handlePreviewScroll"
          v-html="previewHTML"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { eventBus, AppEvents } from '@/events/eventBus'
import { debounce } from '@/utils/helpers'
import { EDITOR } from '@/constants'
import type { ViewMode } from '@/types'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'
import FloatingSearch from './FloatingSearch.vue'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const editorManager = useCrepeEditorManager()

const crepeContainer = ref<HTMLElement | null>(null)
const sourceRef = ref<HTMLTextAreaElement | null>(null)
const splitSourceRef = ref<HTMLTextAreaElement | null>(null)
const splitPreviewRef = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

const sourceContent = ref('')
const previewHTML = ref('')
const currentMode = ref<ViewMode>('wysiwyg')
const showEditorToolbar = ref(false)
const unsubscribes: (() => void)[] = []

const { toggleTypewriterMode, toggleFocusMode } = useWritingEnhancement()

const viewModes = [
  { value: EDITOR.VIEW_MODES.WYSIWYG as ViewMode, label: t('editor.wysiwygMode'), icon: 'wysiwyg' },
  { value: EDITOR.VIEW_MODES.SOURCE as ViewMode, label: t('editor.sourceMode'), icon: 'code' },
  { value: EDITOR.VIEW_MODES.SPLIT as ViewMode, label: t('editor.splitMode'), icon: 'split' }
]

const activeTab = computed(() => tabsStore.activeTab)

const contentClasses = computed(() => ({
  [`mode-${currentMode.value}`]: true,
  'typewriter-mode': prefsStore.typewriterMode,
  'focus-mode': prefsStore.focusMode
}))

watch(activeTab, async (tab, oldTab) => {
  if (tab) {
    console.log('[EditorContainer] Tab changed:', tab.id, 'content length:', tab.content.length)
    
    // 如果是标签页切换，或者是从欢迎页首次打开文件（oldTab 为 null 但 tab 有内容）
    if (editorManager.isReady()) {
      if ((oldTab && tab.id !== oldTab.id) || (!oldTab && tab.content)) {
        console.log('[EditorContainer] Switching to tab:', tab.id)
        await editorManager.switchToTab(tab.id)
        console.log('[EditorContainer] Switched to tab:', tab.id, 'content:', tab.content.substring(0, 50))
      }
    } else {
      console.log('[EditorContainer] Editor not ready yet, will sync after init')
    }
    
    // 更新源码内容
    sourceContent.value = tab.content
    updatePreview()
  }
}, { immediate: true })

const handleViewModeChange = async (mode: ViewMode) => {
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editorManager.isReady()) {
      sourceContent.value = editorManager.getMarkdown()
    }
  }

  if (mode === EDITOR.VIEW_MODES.WYSIWYG && currentMode.value !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editorManager.isReady()) {
      await editorManager.setMarkdown(sourceContent.value)
    }
  }

  currentMode.value = mode
  editorManager.setViewMode(mode)
  updatePreview()
}

const handleSourceInput = debounce(() => {
  if (activeTab.value && editorManager.isReady()) {
    tabsStore.updateTab(activeTab.value.id, {
      content: sourceContent.value,
      isDirty: true,
    })
    editorManager.setMarkdown(sourceContent.value)
    updatePreview()
  }
}, 100)

function updatePreview() {
  if (currentMode.value === EDITOR.VIEW_MODES.SPLIT) {
    previewHTML.value = editorManager.getHTML() || ''
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

let isScrollingFromSource = false
let isScrollingFromPreview = false

function handleSourceScroll(e: Event) {
  if (currentMode.value === EDITOR.VIEW_MODES.SPLIT && !isScrollingFromPreview) {
    isScrollingFromSource = true
    const source = e.target as HTMLTextAreaElement
    if (splitPreviewRef.value) {
      const sourceScrollRatio = source.scrollTop / (source.scrollHeight - source.clientHeight || 1)
      splitPreviewRef.value.scrollTop = sourceScrollRatio * (splitPreviewRef.value.scrollHeight - splitPreviewRef.value.clientHeight)
    }
    setTimeout(() => {
      isScrollingFromSource = false
    }, 50)
  }
}

function handlePreviewScroll(e: Event) {
  if (currentMode.value === EDITOR.VIEW_MODES.SPLIT && !isScrollingFromSource) {
    isScrollingFromPreview = true
    const preview = e.target as HTMLElement
    if (splitSourceRef.value) {
      const previewScrollRatio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1)
      splitSourceRef.value.scrollTop = previewScrollRatio * (splitSourceRef.value.scrollHeight - splitSourceRef.value.clientHeight)
    }
    setTimeout(() => {
      isScrollingFromPreview = false
    }, 50)
  }
}

const unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, (payload) => {
  const data = payload as { tabId: string; content: string }
  if (data && data.tabId === activeTab.value?.id) {
    sourceContent.value = data.content
    updatePreview()
  }
})
unsubscribes.push(unsubscribeContentChanged)

const unsubscribeEditorReady = eventBus.on(AppEvents.EDITOR_READY, async (payload) => {
  const data = payload as { tabId: string | null }
  console.log('[EditorContainer] Editor ready event received:', data)
  
  if (activeTab.value && editorManager.isReady()) {
    console.log('[EditorContainer] Syncing content after editor ready')
    await editorManager.switchToTab(activeTab.value.id)
  }
})
unsubscribes.push(unsubscribeEditorReady)

onMounted(async () => {
  console.log('[EditorContainer] onMounted called')
  console.log('[EditorContainer] crepeContainer:', crepeContainer.value)
  console.log('[EditorContainer] activeTab:', activeTab.value)
  
  if (crepeContainer.value) {
    const initialContent = activeTab.value?.content || ''
    const tabId = activeTab.value?.id
    console.log('[EditorContainer] Initializing with content length:', initialContent.length)
    
    try {
      await editorManager.init(crepeContainer.value, initialContent, tabId)
      console.log('[EditorContainer] EditorManager initialized successfully')
      
      if (tabId && initialContent) {
        console.log('[EditorContainer] Syncing content after init')
        await editorManager.switchToTab(tabId)
      }
    } catch (error) {
      console.error('[EditorContainer] Failed to initialize:', error)
    }
  } else {
    console.error('[EditorContainer] crepeContainer is null!')
  }
  
  window.addEventListener('keydown', handleEditorKeydown)
})

onUnmounted(async () => {
  console.log('[EditorContainer] onUnmounted called - NOT destroying editor (singleton mode)')
  unsubscribes.forEach(unsubscribe => unsubscribe())
  // 不再销毁编辑器，因为它是单例模式
  // await editorManager.destroy()
  window.removeEventListener('keydown', handleEditorKeydown)
  console.log('[EditorContainer] Event listeners cleaned up')
})

function handleEditorKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    floatingSearchRef.value?.show()
  }
}
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
      padding: 30px 80px;
      overflow: auto;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;

      :deep(.crepe) {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
      }

      :deep(.milkdown) {
        outline: none;
        min-height: 0;
        
        .ProseMirror {
          outline: none;
          caret-color: var(--text-primary, #333);
          color: var(--editor-text, #333);
          padding: 8px 16px !important;
          
          &.ProseMirror-focused {
            outline: none;
          }
        }
      }

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
