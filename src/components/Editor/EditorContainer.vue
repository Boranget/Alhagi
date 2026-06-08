<template>
  <div
    class="editor-container"
    :class="{
      'focus-mode': prefsStore.focusMode,
      'typewriter-mode': prefsStore.typewriterMode
    }"
    :style="containerStyle"
  >
    <div
      class="editor-content"
      :class="contentClasses"
    >
      <FloatingSearch ref="floatingSearchRef" />
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
        @click="handleCrepeClick"
      />

      <!-- CodeMirror 编辑器 - 源码模式 -->
      <CodeMirrorEditor
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
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useImageInsert } from '@/composables/useImageInsert'
import { useEditorView } from '@/composables/useEditorView'
import { eventBus, AppEvents } from '@/events/eventBus'
import { debounce } from '@/utils/helpers'
import { EDITOR, FILE } from '@/constants'
import type { ViewMode } from '@/types'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'
import FloatingSearch from './FloatingSearch.vue'
import CodeMirrorEditor from './CodeMirrorEditor.vue'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const editorManager = useCrepeEditorManager()
const { insertImage } = useImageInsert()
const {
  currentMode,
  splitRatio,
  isResizing,
  windowWidth,
  windowHeight,
  isSmallScreen,
  editorScale
} = useEditorView()

const crepeContainer = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)
const imagePasteHandler = ref<((e: ClipboardEvent) => void) | null>(null)
let hasSetupImagePaste = false
const instanceCount = 0

const sourceContent = ref('')
const unsubscribes: (() => void)[] = []

const activeTab = computed(() => tabsStore.activeTab)

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
  sourceContent.value = val
  handleSourceContentChange(val)
}

const handleCrepeFocus = () => {
  editorManager.setActiveEditor('crepe')
}

const handleCrepeClick = () => {
  if (editorManager.isReady()) {
    editorManager.focus()
  }
}

const handleCodeMirrorFocus = () => {
  editorManager.setActiveEditor('codemirror')
}

const handleCodeMirrorBlur = () => {
  editorManager.setActiveEditor(null)
}

const handleViewModeChange = async (mode: ViewMode) => {
  const prevMode = currentMode.value
  
  if (mode === prevMode) {
    return
  }
  
  // 如果切换到非 WYSIWYG 模式，同步 Crepe 的内容到 CodeMirror
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG && editorManager.isReady()) {
    sourceContent.value = editorManager.getMarkdown()
  }

  // 如果切换到 WYSIWYG 模式，同步 CodeMirror 的内容到 Crepe
  if (mode === EDITOR.VIEW_MODES.WYSIWYG && prevMode !== EDITOR.VIEW_MODES.WYSIWYG) {
    if (editorManager.isReady()) {
      await editorManager.setMarkdown(sourceContent.value)
    }
  }

  // 更新模式
  currentMode.value = mode
  editorManager.setViewMode(mode)
  
  // 等待 DOM 更新，让 v-show 生效
  await nextTick()
}

const handleResizerMouseDown = (_e: MouseEvent) => {
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
    // 在非 WYSIWYG 模式下，总是更新 sourceContent
    if (currentMode.value !== EDITOR.VIEW_MODES.WYSIWYG) {
      sourceContent.value = data.content
    }
  }
})
unsubscribes.push(unsubscribeContentChanged)

const unsubscribeEditorReady = eventBus.on(AppEvents.EDITOR_READY, async () => {
  if (activeTab.value && editorManager.isReady()) {
    await editorManager.switchToTab(activeTab.value.id)
  }
})
unsubscribes.push(unsubscribeEditorReady)

const unsubscribeViewModeChanged = eventBus.on(AppEvents.VIEW_MODE_CHANGED, async (mode) => {
  await handleViewModeChange(mode as 'wysiwyg' | 'source' | 'split')
})
unsubscribes.push(unsubscribeViewModeChanged)

const unsubscribeEditUndo = eventBus.on(AppEvents.EDIT_UNDO, () => {
  if (currentMode.value === 'source' || currentMode.value === 'split') {
    const codemirrorEditor = document.querySelector('.codemirror-editor .cm-editor') as HTMLElement
    if (codemirrorEditor && '_editableView' in codemirrorEditor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editableView = (codemirrorEditor as any)._editableView
      if (editableView?.view) {
        editableView.view.dispatch({
          userEvent: 'undo'
        })
      }
    }
  }
  if (editorManager.isReady()) {
    editorManager.undo()
  }
})
unsubscribes.push(unsubscribeEditUndo)

const unsubscribeEditRedo = eventBus.on(AppEvents.EDIT_REDO, () => {
  if (currentMode.value === 'source' || currentMode.value === 'split') {
    const codemirrorEditor = document.querySelector('.codemirror-editor .cm-editor') as HTMLElement
    if (codemirrorEditor && '_editableView' in codemirrorEditor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editableView = (codemirrorEditor as any)._editableView
      if (editableView?.view) {
        editableView.view.dispatch({
          userEvent: 'redo'
        })
      }
    }
  }
  if (editorManager.isReady()) {
    editorManager.redo()
  }
})
unsubscribes.push(unsubscribeEditRedo)

// 滚动监听已移除，改为在 switchToTab 时一次性保存状态

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
      console.error('[EditorContainer] 编辑器初始化失败:', error)
    }
  }
  
  window.addEventListener('keydown', handleEditorKeydown)
  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('mousemove', handleResizerMouseMove)
  document.addEventListener('mouseup', handleResizerMouseUp)
  
  // 监听搜索事件（来自菜单或命令系统）
  window.addEventListener('editor:showSearch', handleShowSearch)
  
  setupImageDrop()
  setupImagePaste()
})

onUnmounted(async () => {
  console.log(`[EditorContainer] onUnmounted called (instance #${instanceCount})`)
  unsubscribes.forEach(unsubscribe => unsubscribe())
  window.removeEventListener('keydown', handleEditorKeydown)
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('mousemove', handleResizerMouseMove)
  document.removeEventListener('mouseup', handleResizerMouseUp)
  window.removeEventListener('editor:showSearch', handleShowSearch)
  window.removeEventListener('editor:insertImage', handleInsertImage)
  
  const container = crepeContainer.value
  if (container && imagePasteHandler.value) {
    container.removeEventListener('paste', imagePasteHandler.value, true)
  }
})

function handleEditorKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    floatingSearchRef.value?.show()
    return
  }
  
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
    e.preventDefault()
    handleInsertImage()
  }
}

function handleShowSearch(e: Event) {
  const customEvent = e as CustomEvent<{ showReplace?: boolean }>
  floatingSearchRef.value?.show()
  // 如果需要显示替换框，可以在这里处理
  if (customEvent.detail?.showReplace) {
    // TODO: 显示替换框
  }
}

function handleInsertImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = FILE.IMAGE_EXTENSIONS.join(',')
  input.multiple = false
  
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      await insertImage(file)
    }
  }
  
  input.click()
}

function setupImageDrop() {
  const container = crepeContainer.value
  if (!container) return
  
  container.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'copy'
  })
  
  container.addEventListener('drop', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    
    for (const file of Array.from(files)) {
      if (FILE.IMAGE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))) {
        await insertImage(file)
      }
    }
  })
}

function setupImagePaste() {
  const container = crepeContainer.value
  if (!container) return
  
  if (hasSetupImagePaste) {
    console.log('[粘贴] 已设置过图片粘贴监听器，跳过')
    return
  }
  hasSetupImagePaste = true
  console.log('[粘贴] 开始设置图片粘贴监听器')
  
  let isProcessingPaste = false
  
  imagePasteHandler.value = async (e: ClipboardEvent) => {
    if (isProcessingPaste) {
      console.log('[粘贴] 正在处理中，跳过重复触发')
      return
    }
    isProcessingPaste = true
    
    try {
      console.log('\n========== [剪贴板粘贴事件] ==========')
      console.log('[粘贴] 事件触发')
      
      const items = e.clipboardData?.items
      if (!items) {
        console.log('[粘贴] 没有剪贴板数据')
        return
      }
      
      console.log('[粘贴] 剪贴板项目数量:', items.length)
      
      let imageFile: File | null = null
      
      for (const item of Array.from(items)) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file && file.size > 0) {
            imageFile = file
            console.log('[粘贴] 找到图片文件:', file.name, file.size, 'bytes')
            break
          }
        }
        
        if (!item.type || item.type === '') {
          const file = item.getAsFile()
          if (file && file.type && file.type.indexOf('image') !== -1) {
            imageFile = file
            console.log('[粘贴] 找到图片文件（从file.type）:', file.name, file.size, 'bytes')
            break
          }
        }
      }
      
      if (!imageFile) {
        console.log('[粘贴] 没有找到图片文件，退出')
        return
      }
      
      e.preventDefault()
      e.stopPropagation()
      
      let originalPath: string | undefined = undefined
      
      for (const item of Array.from(items)) {
        if (item.type === 'text/html') {
          const htmlData = await new Promise<string>((resolve) => {
            item.getAsString(resolve)
          })
          const urlMatch = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i)
          if (urlMatch && urlMatch[1]) {
            const src = urlMatch[1]
            if (/^https?:\/\//.test(src) || /^file:\/\/\//.test(src)) {
              originalPath = src
              console.log('[粘贴] 找到原始路径:', originalPath)
              break
            }
          }
        }
      }
      
      console.log('[粘贴] 开始插入图片')
      await insertImage(imageFile, originalPath)
      console.log('[粘贴] 图片插入完成')
      console.log('========== [剪贴板粘贴事件结束] ==========\n')
    } finally {
      isProcessingPaste = false
    }
  }
  
  container.addEventListener('paste', imagePasteHandler.value, true)
  console.log('[粘贴] 图片粘贴监听器已添加')
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

  // ── 打字机模式 ──
  &.typewriter-mode {
    // WYSIWYG 视图：给 ProseMirror 添加大量上下 padding，
    // 确保即使文档很短，光标也能被滚动到视口中央
    .editor-wysiwyg, .editor-split-preview {
      :deep(.ProseMirror) {
        padding-top: 45vh !important;
        padding-bottom: 45vh !important;
        min-height: 100%;
      }
    }

    // 源码视图：通过 scroll-padding 实现类似效果
    .codemirror-editor {
      :deep(.cm-scroller) {
        scroll-padding-top: 45vh;
        scroll-padding-bottom: 45vh;
      }
    }

    // 分屏源码
    .editor-split-source {
      :deep(.cm-scroller) {
        scroll-padding-top: 45vh;
        scroll-padding-bottom: 45vh;
      }
    }
  }

  // ── 专注模式 ──
  &.focus-mode {
    // WYSIWYG：所有内容块默认为弱化状态
    // 参考 MarkText 的简洁实现方式
    .editor-wysiwyg, .editor-split-preview {
      :deep(.ProseMirror) {
        // 所有 ProseMirror 下的直接子元素都默认弱化
        > * {
          opacity: 0.25 !important;
          transition: opacity 0.35s ease;
        }
        
        // 高优先级选择器：确保 focus-highlight 保持正常
        > .focus-highlight {
          opacity: 1 !important;
        }

        ::selection {
          background: var(--primary-color);
          color: white;
        }
      }
    }

    // 源码视图：所有行默认为弱化状态，当前活动行保持正常
    // 使用 CodeMirror 内置的 cm-activeLine 类来高亮当前行
    .codemirror-editor, .editor-split-source {
      :deep(.cm-line) {
        opacity: 0.1;
        transition: opacity 0.35s ease;

        &.cm-activeLine {
          opacity: 1;
        }
      }
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
