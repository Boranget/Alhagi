<template>
  <div
    class="editor-container"
    :style="containerStyle"
  >
    <FloatingSearch ref="floatingSearchRef" />
    <div
      class="editor-content"
      :class="contentClasses"
    >
      <div 
        v-if="isUnsupportedFile"
        class="unsupported-file-message"
      >
        <Icon name="file" size="lg" class="message-icon" />
        <h3>{{ t('editor.unsupportedFileType') }}</h3>
        <p>{{ activeTab?.filePath }}</p>
        <p class="hint">{{ t('editor.onlyMarkdownSupported') }}</p>
      </div>

      <ImagePreview
        v-else-if="isImageFile"
        :file-path="activeTab?.filePath ?? null"
      />

      <template v-else>
        <CodeMirrorEditor
          v-show="currentMode === EDITOR.VIEW_MODES.SOURCE"
          :model-value="sourceContent"
          @update:model-value="handleCodeMirrorChange"
          @focus="handleCodeMirrorFocus"
          @blur="handleCodeMirrorBlur"
        />

        <div
          v-show="currentMode === EDITOR.VIEW_MODES.SPLIT"
          class="editor-split-source"
        >
          <CodeMirrorEditor
            :model-value="sourceContent"
            @update:model-value="handleCodeMirrorChange"
            @focus="handleCodeMirrorFocus"
            @blur="handleCodeMirrorBlur"
          />
        </div>

        <div
          v-show="currentMode === EDITOR.VIEW_MODES.SPLIT"
          class="split-resizer"
          @mousedown="handleResizerMouseDown"
        >
          <div class="split-resizer-handle" />
        </div>

        <div
          v-show="currentMode === EDITOR.VIEW_MODES.WYSIWYG || currentMode === EDITOR.VIEW_MODES.SPLIT"
          ref="crepeContainer"
          class="crepe"
          :class="{
            'editor-wysiwyg': currentMode === EDITOR.VIEW_MODES.WYSIWYG,
            'editor-split-preview': currentMode === EDITOR.VIEW_MODES.SPLIT
          }"
          @focus="handleCrepeFocus"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { debounce } from '@/utils/helpers'
import { EDITOR } from '@/constants'
import type { ViewMode } from '@/types'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'
import FloatingSearch from './FloatingSearch.vue'
import CodeMirrorEditor from './CodeMirrorEditor.vue'
import ImagePreview from './ImagePreview.vue'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const editorManager = useCrepeEditorManager()

const crepeContainer = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

const sourceContent = ref('')
const currentMode = ref<ViewMode>('wysiwyg')
const splitRatio = ref(50)
const isResizing = ref(false)
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)
const unsubscribes: (() => void)[] = []

const activeTab = computed(() => tabsStore.activeTab)

const isEditorFile = computed(() => activeTab.value?.fileType === 'editor')
const isImageFile = computed(() => activeTab.value?.fileType === 'image')
const isUnsupportedFile = computed(() => activeTab.value?.fileType === 'unsupported')

const isSmallScreen = computed(() => windowWidth.value < 800)
const editorScale = computed(() => {
  if (windowWidth.value < 600) return 0.8
  if (windowWidth.value < 1000) return 0.9
  return 1
})

const containerStyle = computed(() => ({
  '--editor-scale': editorScale.value.toString()
}))

const contentClasses = computed(() => ({
  [`mode-${currentMode.value}`]: isEditorFile.value,
  'typewriter-mode': prefsStore.typewriterMode && isEditorFile.value,
  'focus-mode': prefsStore.focusMode && isEditorFile.value,
  'small-screen': isSmallScreen.value
}))

watch(activeTab, async (tab, oldTab) => {
  if (!tab) return
  
  if (isEditorFile.value) {
    sourceContent.value = tab.content
    currentMode.value = tab.viewMode
    
    await nextTick()
    
    if (!crepeContainer.value) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    if (!editorManager.isReady() && crepeContainer.value) {
      await editorManager.init(crepeContainer.value, tab.content, tab.id)
      await editorManager.switchToTab(tab.id)
    } else if (editorManager.isReady() && crepeContainer.value) {
      const containerContent = crepeContainer.value.innerHTML.trim()
      if (!containerContent) {
        await editorManager.init(crepeContainer.value, tab.content, tab.id)
        await editorManager.switchToTab(tab.id)
      } else {
        if ((oldTab && tab.id !== oldTab.id) || (!oldTab && tab.content)) {
          await editorManager.switchToTab(tab.id)
        }
      }
    } else if (editorManager.isReady() && !crepeContainer.value) {
      await new Promise(resolve => setTimeout(resolve, 50))
      if (crepeContainer.value) {
        await editorManager.init(crepeContainer.value, tab.content, tab.id)
        await editorManager.switchToTab(tab.id)
      }
    }
  }
}, { immediate: true })

const handleCodeMirrorChange = (val: string) => {
  sourceContent.value = val
  handleSourceContentChange(val)
}

const handleCrepeFocus = () => {
  editorManager.setActiveEditor('crepe')
}

const handleCodeMirrorFocus = () => {
  editorManager.setActiveEditor('codemirror')
}

const handleCodeMirrorBlur = () => {
  editorManager.setActiveEditor(null)
}

const handleViewModeChange = async (mode: ViewMode) => {
  if (!isEditorFile.value) return
  
  const prevMode = currentMode.value
  
  if (mode === prevMode) {
    return
  }
  
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG && editorManager.isReady()) {
    sourceContent.value = editorManager.getMarkdown()
  }

  if (mode === EDITOR.VIEW_MODES.WYSIWYG && prevMode !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editorManager.isReady()) {
      await editorManager.setMarkdown(sourceContent.value)
    }
  }

  currentMode.value = mode
  editorManager.setViewMode(mode)
  
  await nextTick()
}

const handleResizerMouseDown = (e: MouseEvent) => {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleResizerMouseMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  
  const container = document.querySelector('.editor-content.mode-split') as HTMLElement
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
  if (!isEditorFile.value) return
  
  const content = newContent as string
  if (activeTab.value && editorManager.isReady()) {
    tabsStore.updateTab(activeTab.value.id, {
      content: content,
      isDirty: true,
    })
    
    const activeEditor = editorManager.getActiveEditor()
    if (activeEditor === 'codemirror') {
      editorManager.setMarkdown(content)
    }
  }
}, 100)

const handleWindowResize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}

const unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, (payload) => {
  if (!isEditorFile.value) return
  
  const data = payload as { tabId: string; content: string }
  if (data && data.tabId === activeTab.value?.id) {
    const activeEditor = editorManager.getActiveEditor()
    if (activeEditor !== 'codemirror') {
      sourceContent.value = data.content
    }
  }
})
unsubscribes.push(unsubscribeContentChanged)

const unsubscribeEditorReady = eventBus.on(AppEvents.EDITOR_READY, async (payload) => {
  if (!isEditorFile.value) return
  
  const data = payload as { tabId: string | null }
  
  if (activeTab.value && editorManager.isReady()) {
    await editorManager.switchToTab(activeTab.value.id)
  }
})
unsubscribes.push(unsubscribeEditorReady)

const unsubscribeViewModeChanged = eventBus.on(AppEvents.VIEW_MODE_CHANGED, async (mode) => {
  await handleViewModeChange(mode as 'wysiwyg' | 'source' | 'split')
})
unsubscribes.push(unsubscribeViewModeChanged)

onMounted(() => {
  window.addEventListener('keydown', handleEditorKeydown)
  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('mousemove', handleResizerMouseMove)
  document.addEventListener('mouseup', handleResizerMouseUp)
})

onUnmounted(async () => {
  unsubscribes.forEach(unsubscribe => unsubscribe())
  window.removeEventListener('keydown', handleEditorKeydown)
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('mousemove', handleResizerMouseMove)
  document.removeEventListener('mouseup', handleResizerMouseUp)
})

function handleEditorKeydown(e: KeyboardEvent) {
  if (!isEditorFile.value) return
  
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
  min-height: 0;
}

.editor-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;

  &.mode-wysiwyg {
    .editor-wysiwyg {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      transition: all 0.3s ease;
      display: block;
      min-height: 0;

      &::-webkit-scrollbar {
        width: 12px;
      }

      :deep(.crepe) {
        display: block;
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        transform-origin: top center;
        transform: scale(var(--editor-scale, 1));
      }

      :deep(.milkdown) {
        display: block;
        height: auto;
      }

      :deep(.ProseMirror) {
        outline: none;
        padding: 16px 16px !important;

        @media (min-width: 768px) {
          padding: 20px 32px !important;
        }

        @media (min-width: 1024px) {
          padding: 20px 64px !important;
        }
      }

      :deep(.milkdown-block-handle) {
        display: none !important;
      }
    }
  }

  &.mode-source {
    .codemirror-editor {
      flex: 1;
      overflow: hidden;
      min-height: 0;

      :deep(.cm-scroller) {
        &::-webkit-scrollbar {
          width: 12px;
        }
      }

      :deep(.cm-content) {
        padding: 16px 16px !important;

        @media (min-width: 768px) {
          padding: 20px 32px !important;
        }

        @media (min-width: 1024px) {
          padding: 20px 64px !important;
        }
      }
    }
  }

  &.mode-split {
    flex-direction: row;

    .crepe.editor-split-preview {
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      flex-shrink: 0;
      transition: all 0.3s ease;
      display: block;
      min-height: 0;
      width: v-bind('`calc(${100 - splitRatio}% - 3px)`');
      order: 3;

      &::-webkit-scrollbar {
        width: 12px;
      }

      :deep(.crepe) {
        display: block;
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        transform-origin: top center;
        transform: scale(var(--editor-scale, 1));
      }

      :deep(.milkdown) {
        display: block;
        height: auto;
      }

      :deep(.ProseMirror) {
        outline: none;
        padding: 16px 16px 16px 12px !important;

        @media (min-width: 768px) {
          padding: 20px 32px 20px 12px !important;
        }

        @media (min-width: 1024px) {
          padding: 20px 64px 20px 12px !important;
        }
      }

      :deep(.milkdown-block-handle) {
        display: none !important;
      }
    }

    .editor-split-source {
      height: 100%;
      flex-shrink: 0;
      overflow: hidden;
      width: v-bind('`calc(${splitRatio}% - 3px)`');
      order: 1;

      :deep(.codemirror-editor) {
        height: 100%;

        :deep(.cm-scroller) {
          &::-webkit-scrollbar {
            width: 12px;
          }
        }

        :deep(.cm-content) {
          padding: 16px 12px 16px 16px !important;

          @media (min-width: 768px) {
            padding: 20px 12px 20px 32px !important;
          }

          @media (min-width: 1024px) {
            padding: 20px 12px 20px 64px !important;
          }
        }
      }
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
      order: 2;

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
  }

  &.typewriter-mode {
    .editor-wysiwyg, .codemirror-editor, .editor-split-source, .editor-split-preview {
      scroll-behavior: smooth;
    }
  }

  &.focus-mode {
    .editor-wysiwyg, .codemirror-editor {
      background: var(--bg-primary);
    }
  }

  &.small-screen {
    :deep(.milkdown-block-handle) {
      display: none !important;
    }
  }
}

.unsupported-file-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
  text-align: center;
  padding: 40px;

  .message-icon {
    font-size: 64px;
    opacity: 0.5;
  }

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  p {
    margin: 0;
    font-size: 14px;
    max-width: 500px;
    word-break: break-all;
  }

  .hint {
    font-size: 13px;
    opacity: 0.7;
    margin-top: 8px;
  }
}
</style>
