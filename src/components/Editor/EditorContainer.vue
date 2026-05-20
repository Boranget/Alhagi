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
      <!-- WYSIWYG 模式：只显示 Crepe 编辑器 -->
      <template v-if="currentMode === EDITOR.VIEW_MODES.WYSIWYG">
        <div
          ref="crepeContainer"
          class="crepe wysiwyg-editor"
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
            :style="{ width: `calc(${splitRatio}% - 3px)` }"
          >
            <div class="split-source-content">
              <CodeMirrorEditor
                :model-value="sourceContent"
                @update:model-value="handleCodeMirrorChange"
                @focus="handleCodeMirrorFocus"
              />
            </div>
          </div>
          <div
            class="split-resizer"
            @mousedown="handleResizerMouseDown"
          >
            <div class="split-resizer-handle" />
          </div>
          <div
            ref="crepeContainer"
            class="crepe split-preview"
            :style="{ width: `calc(${100 - splitRatio}% - 3px)` }"
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
const splitRatio = ref(50)
const isResizing = ref(false)
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)
const unsubscribes: (() => void)[] = []

const activeTab = computed(() => tabsStore.activeTab)

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
  [`mode-${currentMode.value}`]: true,
  'typewriter-mode': prefsStore.typewriterMode,
  'focus-mode': prefsStore.focusMode,
  'small-screen': isSmallScreen.value
}))

watch(activeTab, async (tab, oldTab) => {
  if (tab) {
    // 如果是标签页切换，或者是从欢迎页首次打开文件（oldTab 为 null 但 tab 有内容）
    if (editorManager.isReady()) {
      if ((oldTab && tab.id !== oldTab.id) || (!oldTab && tab.content)) {
        await editorManager.switchToTab(tab.id)
      }
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
  
  if (mode === prevMode) {
    return
  }
  
  // 如果切换到非 WYSIWYG 模式，先获取当前内容
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editorManager.isReady()) {
      sourceContent.value = editorManager.getMarkdown()
    }
  }

  // 如果切换到 WYSIWYG 模式，需要先设置内容
  if (mode === EDITOR.VIEW_MODES.WYSIWYG && prevMode !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editorManager.isReady()) {
      await editorManager.setMarkdown(sourceContent.value)
    }
  }

  // 更新模式
  currentMode.value = mode
  editorManager.setViewMode(mode)
  
  // 等待 DOM 更新
  await nextTick()
  
  // 只有在 WYSIWYG 或分屏模式下才需要初始化 Crepe
  if (mode === EDITOR.VIEW_MODES.WYSIWYG || mode === EDITOR.VIEW_MODES.SPLIT) {
    if (crepeContainer.value) {
      const currentContent = activeTab.value?.content || ''
      const currentTabId = activeTab.value?.id
      
      try {
        await editorManager.init(crepeContainer.value, currentContent, currentTabId)
      } catch (error) {
        console.error('[EditorContainer] Failed to initialize Crepe:', error)
      }
    } else {
      console.error('[EditorContainer] crepeContainer is null after mode change!')
    }
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
  
  if (activeTab.value && editorManager.isReady()) {
    await editorManager.switchToTab(activeTab.value.id)
  }
})
unsubscribes.push(unsubscribeEditorReady)

const unsubscribeViewModeChanged = eventBus.on(AppEvents.VIEW_MODE_CHANGED, async (mode) => {
  await handleViewModeChange(mode as 'wysiwyg' | 'source' | 'split')
})
unsubscribes.push(unsubscribeViewModeChanged)

onMounted(async () => {
  if (crepeContainer.value) {
    const initialContent = activeTab.value?.content || ''
    const tabId = activeTab.value?.id
    
    try {
      await editorManager.init(crepeContainer.value, initialContent, tabId)
      
      if (tabId && initialContent) {
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
  unsubscribes.forEach(unsubscribe => unsubscribe())
  window.removeEventListener('keydown', handleEditorKeydown)
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('mousemove', handleResizerMouseMove)
  document.removeEventListener('mouseup', handleResizerMouseUp)
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
  min-height: 0; /* 关键：让 flex 子元素能正确计算高度 */
}

.editor-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0; /* 关键：让 flex 子元素能正确计算高度 */
  display: flex;
  flex-direction: column;

  &.mode-wysiwyg {
    .wysiwyg-editor {
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
    .source-editor-wrapper {
      flex: 1;
      overflow: hidden;
      min-height: 0;

      :deep(.codemirror-editor) {
        height: 100%;

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
  }

  &.mode-split {
    .split-view {
      display: flex;
      flex: 1;
      min-height: 0;

      .split-source {
        height: 100%;
        flex-shrink: 0;
        overflow: hidden;

        .split-source-content {
          height: 100%;

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
        overflow-y: auto;
        overflow-x: hidden;
        flex-shrink: 0;
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
  }
}
</style>
