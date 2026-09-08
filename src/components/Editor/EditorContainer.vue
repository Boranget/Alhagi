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
      <!-- 不支持的文件格式提示 -->
      <div 
        v-if="activeTab && !isSupportedFileType(activeTab.filePath)"
        class="unsupported-file-message"
      >
        <Icon
          name="file"
          size="lg"
          class="message-icon"
        />
        <h3>{{ t('editor.unsupportedFileType') }}</h3>
        <p>{{ activeTab?.filePath }}</p>
        <p class="hint">
          {{ t('editor.onlyMarkdownSupported') }}
        </p>
      </div>

      <!-- Crepe 编辑器 - WYSIWYG 和分屏预览共用 -->
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

      <!-- CodeMirror 编辑器 - 源码模式 -->
      <CodeMirrorEditor
        ref="sourceEditorRef"
        v-show="currentMode === EDITOR.VIEW_MODES.SOURCE"
        :model-value="sourceContent"
        @update:model-value="handleCodeMirrorChange"
        @focus="handleCodeMirrorFocus"
        @blur="handleCodeMirrorBlur"
      />

      <!-- CodeMirror 编辑器 - 分屏源码模式 -->
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

      <!-- 分屏分割线 -->
      <div
        v-show="currentMode === EDITOR.VIEW_MODES.SPLIT"
        class="split-resizer"
        @mousedown="handleResizerMouseDown"
      >
        <div class="split-resizer-handle" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAppContext } from '@/composables/useAppContext'
import { eventBus, AppEvents } from '@/events/eventBus'
import { debounce } from '@/utils/helpers'
import { EDITOR } from '@/constants'
import type { ViewMode } from '@/types'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'
import FloatingSearch from './FloatingSearch.vue'
import CodeMirrorEditor from './CodeMirrorEditor.vue'
import { provideSearchService } from '@/composables/useSearch'
import { CrepeSearchService } from '@/services/search'
import type { SearchService, SearchResult, ReplaceResult } from '@/services/search'
import type { SearchConfig } from '@/utils/search'

const { tabs, editor, viewMode } = useAppContext()

const crepeContainer = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)
const sourceEditorRef = ref<InstanceType<typeof CodeMirrorEditor> | null>(null)

const sourceContent = ref('')
const currentMode = ref<ViewMode>('wysiwyg')
const splitRatio = ref(50)
const isResizing = ref(false)
const windowWidth = ref(window.innerWidth)
const unsubscribes: (() => void)[] = []

const searchService = computed(() => {
  if (currentMode.value === 'wysiwyg' || currentMode.value === 'split') {
    return new CrepeSearchService(() => editor.getView())
  }
  // Issue 3 fix: 源码模式返回 CodeMirrorSearchService 代理，
  // 委托给 CodeMirrorEditor 暴露的搜索方法
  if (currentMode.value === 'source' && sourceEditorRef.value) {
    const ref = sourceEditorRef.value
    return {
      search: (config: SearchConfig, options?: { select?: boolean }) => ref.search(config, options),
      clear: () => ref.clearSearch(),
      findNext: (): SearchResult => ref.findNext(),
      findPrev: (): SearchResult => ref.findPrev(),
      replaceNext: (replacement: string): SearchResult => ref.replaceNext(replacement),
      replaceAll: (replacement: string): ReplaceResult => ref.replaceAll(replacement),
    } as SearchService
  }
  return null
})

provideSearchService(searchService)

const activeTab = tabs.activeTab

const isSmallScreen = computed(() => windowWidth.value < 800)
const editorScale = computed(() => {
  if (windowWidth.value < 600) return 0.8
  if (windowWidth.value < 1000) return 0.9
  return 1
})

// 检查文件是否为支持的格式（仅支持 Markdown）
function isSupportedFileType(filePath: string | null): boolean {
  if (!filePath) return true // 没有文件路径时（欢迎页）显示编辑器
  const ext = filePath.split('.').pop()?.toLowerCase()
  return ext === 'md' || ext === 'markdown'
}

const containerStyle = computed(() => ({
  '--editor-scale': editorScale.value.toString()
}))

const contentClasses = computed(() => ({
  [`mode-${currentMode.value}`]: true,
  'typewriter-mode': viewMode.typewriterMode.value,
  'focus-mode': viewMode.focusMode.value,
  'small-screen': isSmallScreen.value
}))

watch(activeTab, async (tab, oldTab) => {
  if (tab) {
    // 如果是标签页切换，或者是从欢迎页首次打开文件（oldTab 为 null 但 tab 有内容）
    if (editor.isReady()) {
      if ((oldTab && tab.id !== oldTab.id) || (!oldTab && tab.content)) {
        await editor.switchToTab(tab.id)
      }
    }
    
    // 更新源码内容
    sourceContent.value = tab.content
  }
}, { immediate: true })

const handleCodeMirrorChange = (val: string) => {
  sourceContent.value = val
  handleSourceContentChange(val)
}

const handleCrepeFocus = () => {
  editor.setActiveEditor('crepe')
}

const handleCodeMirrorFocus = () => {
  editor.setActiveEditor('codemirror')
}

const handleCodeMirrorBlur = () => {
  editor.setActiveEditor(null)
}

const handleViewModeChange = async (mode: ViewMode) => {
  const prevMode = currentMode.value
  
  if (mode === prevMode) {
    return
  }
  
  // 如果切换到非 WYSIWYG 模式，同步 Crepe 的内容到 CodeMirror
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG && editor.isReady()) {
    sourceContent.value = editor.getMarkdown()
  }

  // 如果切换到 WYSIWYG 模式，同步 CodeMirror 的内容到 Crepe
  if (mode === EDITOR.VIEW_MODES.WYSIWYG && prevMode !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editor.isReady()) {
      await editor.setMarkdown(sourceContent.value)
    }
  }

  // 更新模式
  currentMode.value = mode
  editor.setViewMode(mode)
  
  // 等待 DOM 更新，让 v-show 生效
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
  const content = newContent as string
  if (activeTab.value && editor.isReady()) {
    tabs.update(activeTab.value.id, {
      content: content,
      isDirty: true,
    })
    editor.setMarkdown(content)
  }
}, 100)

const handleWindowResize = () => {
  windowWidth.value = window.innerWidth
}

const unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, (payload) => {
  const data = payload as { tabId: string; content: string }
  if (data && data.tabId === activeTab.value?.id) {
    const activeEditor = editor.getActiveEditor()
    if (activeEditor !== 'codemirror') {
      sourceContent.value = data.content
    }
  }
})
unsubscribes.push(unsubscribeContentChanged)

const unsubscribeEditorReady = eventBus.on(AppEvents.EDITOR_READY, async (payload) => {
  const data = payload as { tabId: string | null }
  
  if (activeTab.value && editor.isReady()) {
    await editor.switchToTab(activeTab.value.id)
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
      await editor.init(crepeContainer.value, initialContent, tabId)
      
      if (tabId && initialContent) {
        await editor.switchToTab(tabId)
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
  min-height: 0;
  display: flex;
  flex-direction: column;

  // WYSIWYG 模式样式
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

  // 源码模式样式
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

  // 分屏模式样式
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
      order: 3; /* 确保在最右边 */

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
      order: 1; /* 确保在最左边 */

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
      order: 2; /* 确保在中间 */

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
