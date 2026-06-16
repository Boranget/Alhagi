<template>
  <div
    class="editor-container"
    :class="{
      'focus-mode': viewMode.focusMode,
      'typewriter-mode': viewMode.typewriterMode
    }"
    :style="containerStyle"
  >
    <div
      class="editor-content"
      :class="contentClasses"
    >
      <FloatingSearch ref="floatingSearchRef" />

      <!-- 编辑器（Crepe + CodeMirror）始终保留在 DOM 中——避免切到图片/不支持文件时
           Crepe 实例被 v-if 卸载，下次切回 markdown 标签需重新 init 造成短暂空白 + 状态丢失。
           image / unsupported 通过绝对定位覆盖在编辑器上方，只在非编辑器文件类型时显示。 -->
      <div
        v-show="!isImageFile && !isUnsupportedFile"
        class="editor-shell"
      >
        <!-- Crepe 编辑器 - WYSIWYG 和分屏预览共用
             性能：用 v-show 保留 Crepe 实例避免反复 init；<Transition> 配 v-show
             会在 enter/leave 时正确触发 opacity 过渡（Vue 内部把 display 切换延后到
             transition 结束）。 -->
        <Transition name="pane-fade">
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
        </Transition>

        <!-- CodeMirror 编辑器 - 源码模式和分屏模式共用 -->
        <Transition name="pane-fade">
          <div
            v-show="currentMode === EDITOR.VIEW_MODES.SOURCE || currentMode === EDITOR.VIEW_MODES.SPLIT"
            class="codemirror-wrapper"
            :class="{
              'editor-source': currentMode === EDITOR.VIEW_MODES.SOURCE,
              'editor-split-source': currentMode === EDITOR.VIEW_MODES.SPLIT
            }"
          >
            <CodeMirrorEditor
              ref="codeMirrorEditorRef"
              :model-value="sourceContent"
              @update:model-value="handleCodeMirrorChange"
              @focus="handleCodeMirrorFocus"
              @blur="handleCodeMirrorBlur"
            />
          </div>
        </Transition>

        <!-- 分屏分割线 -->
        <Transition name="pane-fade">
          <div
            v-show="currentMode === EDITOR.VIEW_MODES.SPLIT"
            class="split-resizer"
            @mousedown="handleResizerMouseDown"
          >
            <div class="split-resizer-handle" />
          </div>
        </Transition>
      </div>

      <!-- 不支持的文件格式提示（覆盖层） -->
      <div
        v-if="isUnsupportedFile"
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

      <!-- 图片文件预览（覆盖层） -->
      <ImagePreview
        v-if="isImageFile"
        class="image-preview-overlay"
        :file-path="activeTab?.filePath ?? null"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useViewModeStore } from '@/stores/viewMode'
import { useEditorView } from '@/composables/useEditorView'
import { eventBus, AppEvents } from '@/events/eventBus'
import { debounce } from '@/utils/helpers'
import { EDITOR, FILE } from '@/constants'
import type { ViewMode } from '@/types'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { useImageInsertOrchestrator } from '@/services/image/ImageInsertOrchestrator'
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'
import FloatingSearch from './FloatingSearch.vue'
import CodeMirrorEditor from './CodeMirrorEditor.vue'
import ImagePreview from './ImagePreview.vue'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const viewMode = useViewModeStore()

const editorManager = useCrepeEditorManager()
const imageOrchestrator = useImageInsertOrchestrator()
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
const codeMirrorEditorRef = ref<InstanceType<typeof CodeMirrorEditor> | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

const sourceContent = ref('')
const unsubscribes: (() => void)[] = []

const activeTab = computed(() => tabsStore.activeTab)

// 文件类型分支：Crepe/CodeMirror 编辑器仅适用 fileType === 'editor'。
// 图片走专用 ImagePreview，其它扩展名走"不支持"提示。
// 欢迎页（无 activeTab / 无 filePath）也走 editor 分支，让 Crepe 挂载占位。
const isImageFile = computed(() => activeTab.value?.fileType === 'image')
const isUnsupportedFile = computed(() => activeTab.value?.fileType === 'unsupported')

const containerStyle = computed(() => ({
  '--editor-scale': editorScale.value.toString()
}))

const contentClasses = computed(() => ({
  [`mode-${currentMode.value}`]: true,
  'typewriter-mode': viewMode.typewriterMode,
  'focus-mode': viewMode.focusMode,
  'small-screen': isSmallScreen.value
}))

// 监听标签页切换，保存和恢复 CodeMirror 编辑器状态
watch(activeTab, async (tab, oldTab) => {
  if (tab) {
    const previousTabId = oldTab?.id
    
    // 标签页切换时，保存旧标签的 CodeMirror 状态（光标和滚动位置）
    if (previousTabId && previousTabId !== tab.id && codeMirrorEditorRef.value) {
      const currentState = codeMirrorEditorRef.value.getCurrentState()
      const prevTab = tabsStore.getTab(previousTabId)
      if (prevTab) {
        tabsStore.updateTab(previousTabId, {
          codeMirror: {
            ...prevTab.codeMirror,
            cursor: currentState.cursor || prevTab.codeMirror.cursor,
            scrollTop: currentState.scrollTop !== undefined ? currentState.scrollTop : prevTab.codeMirror.scrollTop
          }
        })
      }
    }
    
    // 调用 Crepe 编辑器切换标签页 —— 仅 markdown / 欢迎页（fileType === 'editor'），
    // 图片 / 不支持文件不需要走 Crepe 链路：
    //   - 它们的 tab.content 是空字符串（FileExplorer 已分流）
    //   - 即便不空，也不该灌给 Crepe（会触发 markdownUpdated → isDirty=true）
    if (editorManager.isReady() && tab.fileType === 'editor') {
      if ((oldTab && tab.id !== oldTab.id) || (!oldTab && tab.content)) {
        await editorManager.switchToTab(tab.id)
      }
    }
    
    // 更新源码内容
    sourceContent.value = tab.content
    
    // 等待 DOM 更新后，恢复新标签的 CodeMirror 状态
    await nextTick()
    if (codeMirrorEditorRef.value && tab.codeMirror) {
      codeMirrorEditorRef.value.restoreState(tab.codeMirror.cursor, tab.codeMirror.scrollTop)
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
    editorManager.commands.undo()
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
    editorManager.commands.redo()
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
  
  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('mousemove', handleResizerMouseMove)
  document.addEventListener('mouseup', handleResizerMouseUp)
  
  // 监听搜索事件（来自菜单或命令系统）
  window.addEventListener('editor:showSearch', handleShowSearch)

  // 命令 format.image 派发的「打开文件选择对话框 → 插入图片」事件
  window.addEventListener('editor:insertImage', handleInsertImage)

  // 图片粘贴/拖拽：Crepe upload plugin 内部已注册 handlePaste/handleDrop，
  // 触发后会调用 uploadConfig.uploader（已在 crepeEditorManager 中覆盖为
  // ImageInsertOrchestrator.resolveOnly）。本组件不再单独 wire 事件。
})

onUnmounted(async () => {
  unsubscribes.forEach(unsubscribe => unsubscribe())
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('mousemove', handleResizerMouseMove)
  document.removeEventListener('mouseup', handleResizerMouseUp)
  window.removeEventListener('editor:showSearch', handleShowSearch)
  window.removeEventListener('editor:insertImage', handleInsertImage)
})

function handleShowSearch(e: Event) {
  const customEvent = e as CustomEvent<{ showReplace?: boolean }>
  floatingSearchRef.value?.show()
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
    if (file) await imageOrchestrator.insertFromFile(file)
  }
  input.click()
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
    .codemirror-wrapper.editor-source {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    .codemirror-editor {
      height: 100%;
      overflow: hidden;

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

    .codemirror-wrapper.editor-split-source {
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
  position: absolute;
  inset: 0;
  z-index: 5;
  background: var(--editor-bg);
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

/* 编辑器外壳：把 Crepe + CodeMirror + 分屏分割线包在一起，
 * 通过 v-show 而非 v-if 切换，保持实例不被销毁。 */
.editor-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  overflow: hidden;
}

/* 图片预览覆盖层：与 unsupported 同款，绝对定位填满 .editor-content。
 * 用 :deep() 是因为 .image-preview-overlay class 落在 ImagePreview 子组件的
 * 根元素上，scoped CSS 编译选择器需要穿透才能命中。 */
:deep(.image-preview-overlay) {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: var(--editor-bg);
}

/* ----------------------------------------------------------
 * 视图模式切换动画（WYSIWYG ↔ Source ↔ Split）
 *
 * 用 v-show + Vue <Transition> `<Transition>` 自动管理 enter/leave。
 * 进入/离开两侧都只 animation `opacity`。
 *
 * 不同模式之间不加 `mode="out-in"`（会让每次切换分两段，总时长加倍，
 * 300ms 编辑场景下太拖沓）。两层 pane 同时 cross-fade，
 * 中间会有短暂的双半透明瞬间，但因为 200ms 极短 + 曲线末端慢速切入，
 * 人眼感知为"平滑过渡"而非"闪烁"。极端场景（慢速动画用户）可通过
 * prefers-reduced-motion 关掉。
 *
 * 性能：仅 opacity，合成线程 GPU 加速，0 layout / 0 paint。
 * ---------------------------------------------------------- */

.pane-fade-leave-active,
.pane-fade-enter-active {
  transition: opacity 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
  will-change: opacity;
}

.pane-fade-enter-from,
.pane-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pane-fade-leave-active,
  .pane-fade-enter-active {
    transition-duration: 0ms !important;
  }
}
</style>
