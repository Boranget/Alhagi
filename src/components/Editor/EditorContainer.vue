<template>
  <div
    class="editor-container"
    :style="containerStyle"
  >
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
      <!-- WYSIWYG 模式：只显示 Crepe 编辑器 -->
      <template v-if="currentMode === EDITOR.VIEW_MODES.WYSIWYG">
        <div
          ref="crepeContainer"
          class="wysiwyg-editor"
          @focus="handleCrepeFocus"
        />
      </template>

      <!-- 源码模式：只显示 CodeMirror -->
      <template v-else-if="currentMode === EDITOR.VIEW_MODES.SOURCE">
        <div class="source-editor-wrapper">
          <CodeMirrorEditor
            :model-value="sourceContent"
            @update:model-value="handleCodeMirrorChange"
            @focus="handleCodeMirrorFocus"
          />
        </div>
      </template>

      <!-- 分屏模式：显示两个并排的容器 -->
      <template v-else>
        <div class="split-view">
          <div
            class="split-source"
            :style="{ width: `${splitRatio}%` }"
          >
            <CodeMirrorEditor
              :model-value="sourceContent"
              @update:model-value="handleCodeMirrorChange"
              @focus="handleCodeMirrorFocus"
            />
          </div>
          <div
            class="split-resizer"
            @mousedown="handleResizerMouseDown"
          >
            <div class="split-resizer-handle" />
          </div>
          <div
            ref="crepeContainer"
            class="split-preview"
            :style="{ width: `${100 - splitRatio}%` }"
            @focus="handleCrepeFocus"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
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
import CodeMirrorEditor from './CodeMirrorEditor.vue'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const editorManager = useCrepeEditorManager()

const crepeContainer = ref<HTMLElement | null>(null)
const crepeContainerSplit = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

const sourceContent = ref('')
const currentMode = ref<ViewMode>('wysiwyg')
const showEditorToolbar = ref(false)
const splitRatio = ref(50)
const isResizing = ref(false)
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)
const unsubscribes: (() => void)[] = []

const { toggleTypewriterMode, toggleFocusMode } = useWritingEnhancement()

const viewModes = [
  { value: EDITOR.VIEW_MODES.WYSIWYG as ViewMode, label: t('editor.wysiwygMode'), icon: 'wysiwyg' },
  { value: EDITOR.VIEW_MODES.SOURCE as ViewMode, label: t('editor.sourceMode'), icon: 'code' },
  { value: EDITOR.VIEW_MODES.SPLIT as ViewMode, label: t('editor.splitMode'), icon: 'split' }
]

const activeTab = computed(() => tabsStore.activeTab)

const isSmallScreen = computed(() => windowWidth.value < 800)
const editorPadding = computed(() => isSmallScreen.value ? '10px' : '40px 100px')
const editorScale = computed(() => {
  if (windowWidth.value < 600) return 0.8
  if (windowWidth.value < 1000) return 0.9
  return 1
})

const containerStyle = computed(() => ({
  '--editor-scale': editorScale.value.toString()
}))

const contentClasses = computed(() => ({
  [`mode-${currentMode.value}`]: true,
  'typewriter-mode': prefsStore.typewriterMode,
  'focus-mode': prefsStore.focusMode,
  'small-screen': isSmallScreen.value
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
  }
}, { immediate: true })

const handleCodeMirrorChange = (val: string) => {
  // 编辑 CodeMirror 时设置 activeEditor 为 codemirror
  editorManager.setActiveEditor('codemirror')
  sourceContent.value = val
  handleSourceContentChange(val)
}

const handleCrepeFocus = () => {
  editorManager.setActiveEditor('crepe')
}

const handleCodeMirrorFocus = () => {
  editorManager.setActiveEditor('codemirror')
}

const handleViewModeChange = async (mode: ViewMode) => {
  const prevMode = currentMode.value
  
  if (mode === prevMode) return
  
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editorManager.isReady()) {
      sourceContent.value = editorManager.getMarkdown()
    }
  }

  if (mode === EDITOR.VIEW_MODES.WYSIWYG && prevMode !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editorManager.isReady()) {
      await editorManager.setMarkdown(sourceContent.value)
    }
  }

  currentMode.value = mode
  editorManager.setViewMode(mode)
  
  // 当视图模式改变时，我们需要重新初始化 Crepe 到新的容器中
  await nextTick()
  if (crepeContainer.value) {
    const currentContent = activeTab.value?.content || ''
    const currentTabId = activeTab.value?.id
    await editorManager.init(crepeContainer.value, currentContent, currentTabId)
  }
}

const handleResizerMouseDown = (e: MouseEvent) => {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleResizerMouseMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  
  const container = document.querySelector('.split-view') as HTMLElement
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  let newRatio = ((e.clientX - rect.left) / rect.width) * 100
  newRatio = Math.max(20, Math.min(80, newRatio))
  splitRatio.value = newRatio
}

const handleResizerMouseUp = () => {
  isResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

const handleSourceContentChange = debounce((newContent: unknown) => {
  const content = newContent as string
  if (activeTab.value && editorManager.isReady()) {
    tabsStore.updateTab(activeTab.value.id, {
      content: content,
      isDirty: true,
    })
    editorManager.setMarkdown(content)
  }
}, 100)

const handleWindowResize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}

const unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, (payload) => {
  const data = payload as { tabId: string; content: string }
  if (data && data.tabId === activeTab.value?.id) {
    // 只有当我们不是正在编辑 CodeMirror 时，才更新 sourceContent
    // CrepeEditorManager 已经在 handleMarkdownUpdate 中做了这个判断
    sourceContent.value = data.content
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

const unsubscribeViewModeChanged = eventBus.on(AppEvents.VIEW_MODE_CHANGED, async (mode) => {
  console.log('[EditorContainer] View mode changed via menu:', mode)
  await handleViewModeChange(mode as 'wysiwyg' | 'source' | 'split')
})
unsubscribes.push(unsubscribeViewModeChanged)

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
  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('mousemove', handleResizerMouseMove)
  document.addEventListener('mouseup', handleResizerMouseUp)
})

onUnmounted(async () => {
  console.log('[EditorContainer] onUnmounted called - NOT destroying editor (singleton mode)')
  unsubscribes.forEach(unsubscribe => unsubscribe())
  window.removeEventListener('keydown', handleEditorKeydown)
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('mousemove', handleResizerMouseMove)
  document.removeEventListener('mouseup', handleResizerMouseUp)
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
      padding: v-bind(editorPadding);
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
        transform-origin: top center;
        transform: scale(var(--editor-scale, 1));
      }

      :deep(.milkdown) {
        outline: none;
        min-height: 0;
        
        .milkdown-block-handle {
          display: none !important;
        }
        
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
    .source-editor-wrapper {
      width: 100%;
      height: 100%;
    }
  }

  &.mode-split {
    .split-view {
      display: flex;
      height: 100%;

      .split-source {
        height: 100%;
        flex-shrink: 0;
        overflow: hidden;
      }

      .split-resizer {
        width: 6px;
        background: var(--border-color);
        cursor: col-resize;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s;
        flex-shrink: 0;

        &:hover {
          background: var(--primary-color);
        }

        .split-resizer-handle {
          width: 2px;
          height: 30px;
          background: var(--text-secondary);
          border-radius: 1px;
        }
      }

      .split-preview {
        height: 100%;
        overflow: hidden;
        flex-shrink: 0;

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
          padding: v-bind(editorPadding);
          
          .ProseMirror {
            outline: none;
            caret-color: var(--text-primary, #333);
            color: var(--editor-text, #333);
            padding: 8px 16px !important;
          }
        }
      }
    }
  }

  &.typewriter-mode {
    .wysiwyg-editor, .source-editor-wrapper, .split-source {
      scroll-behavior: smooth;
    }
  }

  &.focus-mode {
    .wysiwyg-editor, .source-editor-wrapper {
      background: var(--bg-primary);
    }
  }

  &.small-screen {
    :deep(.milkdown-block-handle) {
      display: none !important;
    }

    :deep(.milkdown) {
      .crepe, .ProseMirror {
        transform-origin: top center;
      }
    }
  }
}
</style>
