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

      <!-- 主编辑器外壳（Crepe + CodeMirror）始终保留在 DOM 中——避免切到辅助 viewer 时
           Crepe 实例被 v-if 卸载、下次切回 markdown 标签需重新 init 造成短暂空白 + 状态丢失。
           辅助 viewer（image / text / unsupported / 未来 PDF 等）通过绝对定位覆盖在编辑器上方。 -->
      <div
        v-show="useEditorShell"
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
            @scroll="handleCrepeScroll"
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

      <!-- 辅助 viewer 覆盖层（image / text / unsupported / 未来 PDF 等）。
           descriptor.viewer 非 null 时挂载。canSave 决定是否双向绑定 model-value。
           tabId 透传给 viewer，viewer 可往 tab.viewerState[descriptor.id] 持久化私有状态
           （PDF 页码 / 图片 zoom / 文本编辑器光标位置等）。 -->
      <component
        :is="currentDescriptor.viewer"
        v-if="!useEditorShell && currentDescriptor.viewer && activeTab"
        class="viewer-overlay"
        :tab-id="activeTab.id"
        :file-path="activeTab.filePath ?? null"
        :model-value="currentDescriptor.canSave ? activeTab.content : undefined"
        @update:model-value="currentDescriptor.canSave ? handleViewerChange($event) : undefined"
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
import { EDITOR } from '@/constants'
import { getDescriptor, detectDescriptor, type FileTypeDescriptor } from '@/fileTypes'
import type { ViewMode } from '@/types'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { useImageInsertOrchestrator } from '@/services/image/ImageInsertOrchestrator'
import FloatingSearch from './FloatingSearch.vue'
import CodeMirrorEditor from './CodeMirrorEditor.vue'

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

/**
 * 当前 tab 对应的 descriptor —— 渲染分支的单一事实源。
 *   - editor：viewer === null，走主编辑器外壳（Crepe + CodeMirror）
 *   - 其它：viewer 非 null，作为绝对定位覆盖层渲染
 *
 * 欢迎页（无 activeTab）→ 默认按 editor 处理，让 Crepe 挂载占位。
 */
const currentDescriptor = computed<FileTypeDescriptor>(() => {
  if (!activeTab.value) return detectDescriptor(null)
  return getDescriptor(activeTab.value.fileType) ?? detectDescriptor(null)
})

/** 使用主编辑器外壳的条件 = descriptor 没有自己的 viewer。 */
const useEditorShell = computed(() => currentDescriptor.value.viewer === null)
/** 当前 viewer 是否是 markdown 主编辑器（用于"是否走 Crepe.switchToTab"）。 */
const isMarkdownEditor = computed(() => currentDescriptor.value.id === 'editor')

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
    
    // 标签页切换时，保存旧标签的 CodeMirror 状态（光标和滚动位置）。
    // 只保存 markdown 且旧 tab 当前模式是 source/split 的情况；否则隐藏的
    // CodeMirror 实例可能还停留在别的 tab 内容上，保存会覆盖错误状态。
    if (previousTabId && previousTabId !== tab.id && codeMirrorEditorRef.value) {
      const prevTab = tabsStore.getTab(previousTabId)
      const prevUsesSource = prevTab?.fileType === 'editor' &&
        (prevTab.viewMode === EDITOR.VIEW_MODES.SOURCE || prevTab.viewMode === EDITOR.VIEW_MODES.SPLIT)
      if (prevTab && prevUsesSource) {
        const currentState = codeMirrorEditorRef.value.getCurrentState()
        tabsStore.updateTab(previousTabId, {
          codeMirror: {
            ...prevTab.codeMirror,
            cursor: currentState.cursor || prevTab.codeMirror.cursor,
            scrollTop: currentState.scrollTop !== undefined ? currentState.scrollTop : prevTab.codeMirror.scrollTop
          }
        })
      }
    }
    
    // 调用 Crepe 编辑器切换标签页 + 同步源码 CodeMirror —— 仅 markdown
    // （fileType === 'editor'）。辅助 tab（image / text / unsupported / 未来 PDF）
    // 完全不动 sourceContent / Crepe：
    //   - 它们的 tab.content 可能是空（image）或纯文本（text），不能灌给 markdown 解析链
    //   - 灌进去会触发 CM A 的 docChanged → 在 hasFocus 的窄窗口里误标 isDirty
    if (tab.fileType === 'editor') {
      if (editorManager.isReady()) {
        if ((oldTab && tab.id !== oldTab.id) || (!oldTab && tab.content)) {
          await editorManager.switchToTab(tab.id)
        }
      }
      sourceContent.value = tab.content

      // 等待 DOM 更新后，恢复新标签的 CodeMirror 状态。
      // 仅 source/split 模式需要；wysiwyg 下不碰隐藏源码编辑器，避免污染状态。
      await nextTick()
      const usesSource = tab.viewMode === EDITOR.VIEW_MODES.SOURCE || tab.viewMode === EDITOR.VIEW_MODES.SPLIT
      if (usesSource && codeMirrorEditorRef.value && tab.codeMirror) {
        codeMirrorEditorRef.value.restoreState(tab.codeMirror.cursor, tab.codeMirror.scrollTop)
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

const handleCrepeClick = () => {
  if (editorManager.isReady()) {
    editorManager.focus()
  }
}

/**
 * 实时保存 Crepe/WYSIWYG 滚动位置。
 *
 * 过去只在 switchToTab 时读取 scrollTop，per-tab viewMode 后该时机容易撞上
 * v-show / split 布局切换，读到 0 或旧值。现在滚动时就写入当前 tab state，
 * 切走前状态已经是最新，恢复更稳定。
 */
const handleCrepeScroll = debounce((event: unknown) => {
  const tab = activeTab.value
  if (!tab || tab.fileType !== 'editor') return
  const target = (event as Event).currentTarget as HTMLElement | null
  if (!target) return
  tabsStore.updateTab(tab.id, {
    crepe: {
      ...tab.crepe,
      scrollTop: target.scrollTop,
    },
  })
}, 80)

const handleCodeMirrorFocus = () => {
  editorManager.setActiveEditor('codemirror')
}

const handleCodeMirrorBlur = () => {
  editorManager.setActiveEditor(null)
}

const handleViewModeChange = async (mode: ViewMode) => {
  if (!activeTab.value || activeTab.value.fileType !== 'editor') return

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
  // 双重守卫：源码模式 CM 实例（A）只服务 markdown tab。
  // 当 active 是辅助 tab（text/image/unsupported）时，CM A 仍然挂载着但隐藏，
  // 它的 watch(modelValue) 在 sourceContent 变化时会 dispatch 修改 doc，
  // 进而 docChanged 触发 onChange——这里直接拒绝写回，避免误标 isDirty。
  if (!activeTab.value || activeTab.value.fileType !== 'editor') return
  if (!editorManager.isReady()) return
  tabsStore.updateTab(activeTab.value.id, {
    content: content,
    isDirty: true,
  })
  editorManager.setMarkdown(content)
}, 100)

/**
 * 辅助 viewer 内容变化（仅 canSave 的 viewer 触发，如 PlainTextEditor）。
 * 写回 store + 标脏。不调 editorManager.setMarkdown：辅助 tab 不参与 Crepe 链路。
 */
function handleViewerChange(content: string) {
  if (!activeTab.value) return
  tabsStore.updateTab(activeTab.value.id, {
    content,
    isDirty: true,
  })
}

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
  // 从 image descriptor 拿扩展名 —— 单一事实源（fileTypes registry）
  const imageDesc = getDescriptor('image')
  input.accept = imageDesc?.extensions.join(',') ?? ''
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

    // editor-shell 是为了保留 Crepe/CodeMirror DOM 而加的中间层；
    // 分屏真正的三个子项（源码 / 分割条 / 预览）都在它里面，
    // 所以 row 布局必须落在 editor-shell 上。
    .editor-shell {
      flex: 1;
      display: flex;
      flex-direction: row;
      min-width: 0;
      min-height: 0;
    }

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

/* 辅助 viewer 覆盖层（image / text / unsupported / 未来 PDF 等）。
 *
 * 用 :deep() 是因为 viewer 是 dynamic <component>，class 落在子组件根元素上，
 * scoped CSS 编译选择器需要穿透才能命中。
 *
 * 同时只有一个 viewer 在挂载（v-if 保证），所以 z-index 不会互相冲突；
 * z-index:5 高于 .editor-shell 的默认堆叠，盖住底下的 Crepe。 */
:deep(.viewer-overlay) {
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
