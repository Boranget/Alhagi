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
      <UnsupportedFileMessage
        v-if="activeTab && !isSupportedFileType(activeTab.filePath)"
        :file-path="activeTab.filePath || ''"
      />

      <!-- 多实例编辑器容器 — EditorPool 管理内部的 Crepe + CodeMirror -->
      <div
        ref="editorWrapper"
        class="editor-wrapper"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useTabsStore } from '@/stores/tabs'
import { useViewModeStore } from '@/stores/viewMode'
import { useEditorContext } from '@adapters/composables/useEditorContext'
import { eventBus, AppEvents } from '@adapters/composables/useEventBus'
import { EDITOR } from '@/constants'
import type { ViewMode } from '@/types'
import FloatingSearch from './FloatingSearch.vue'
import UnsupportedFileMessage from './UnsupportedFileMessage.vue'
import { provideSearchService } from '@/composables/useSearch'
import { CrepeSearchService } from '@/services/search'
import type { SearchService, SearchResult, ReplaceResult } from '@/services/search'
import type { SearchConfig } from '@/utils/search'
import { useResponsiveEditor } from '@/composables/useResponsiveEditor'

const tabsStore = useTabsStore()
const viewModeStore = useViewModeStore()
const { activeTab, activeTabId } = storeToRefs(tabsStore)
const { typewriterMode, focusMode } = storeToRefs(viewModeStore)
const editorCtx = useEditorContext()
const { windowWidth, isSmallScreen, editorScale } = useResponsiveEditor()

const editorWrapper = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

const currentMode = ref<ViewMode>('wysiwyg')
const unsubscribes: (() => void)[] = []

const searchService = computed(() => {
  // 多实例架构下，搜索服务基于当前活动编辑器
  if (currentMode.value === 'wysiwyg' || currentMode.value === 'split') {
    return new CrepeSearchService(() => editorCtx.getView())
  }
  // 源码模式：使用 CM 搜索服务
  if (currentMode.value === 'source') {
    return editorCtx.getCMSearchService()
  }
  return null
})

provideSearchService(searchService)

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
  'typewriter-mode': typewriterMode.value,
  'focus-mode': focusMode.value,
  'small-screen': isSmallScreen.value
}))

// ============================================================
// Tab 切换逻辑（多实例）
// ============================================================

watch(activeTab, async (tab, oldTab) => {
  const oldId = oldTab?.id ?? 'null'
  const newId = tab?.id ?? 'null'

  if (!tab) {
    return
  }

  // 确保目标 tab 有编辑器实例
  if (!editorCtx.hasTab(tab.id)) {
    await editorCtx.createTab(tab.id, tab.content, tab.viewMode)
  }

  // 切换 tab（显示/隐藏）
  editorCtx.switchTab(tab.id)

  // 同步视图模式
  currentMode.value = tab.viewMode
  editorCtx.setTabViewMode(tab.id, tab.viewMode)
}, { immediate: true })

// ============================================================
// 视图模式切换
// ============================================================

const handleViewModeChange = async (mode: ViewMode) => {
  if (mode === currentMode.value) return
  if (!activeTab.value) return

  // 切换模式时自动关闭搜索框
  floatingSearchRef.value?.hide()

  // 更新模式
  currentMode.value = mode
  editorCtx.setTabViewMode(activeTab.value.id, mode)
  tabsStore.updateTab(activeTab.value.id, { viewMode: mode })

  // 等待 DOM 更新
  await nextTick()
}

// ============================================================
// 事件监听
// ============================================================

const unsubscribeViewModeChanged = eventBus.on(AppEvents.VIEW_MODE_CHANGED, async (mode) => {
  await handleViewModeChange(mode as 'wysiwyg' | 'source' | 'split')
})
unsubscribes.push(unsubscribeViewModeChanged)

// ============================================================
// 生命周期
// ============================================================

onMounted(async () => {
  if (editorWrapper.value) {
    try {
      await editorCtx.initWrapper(editorWrapper.value)
    } catch (error) {
      console.error('[EditorContainer] Failed to initialize wrapper:', error)
    }
  } else {
    console.error('[EditorContainer] editorWrapper is null!')
  }

  // 多实例架构下，InitEditor.execute() 未被调用，需在此注册 CONTENT_CHANGED 事件
  // 使 useWorkspaceSearch 的搜索高亮在编辑时动态更新
  unsubscribes.push(
    editorCtx.onContentChange((markdown) => {
      const tabId = activeTabId.value
      if (tabId) {
        eventBus.emit(AppEvents.CONTENT_CHANGED, { content: markdown, tabId })
      }
    })
  )

  window.addEventListener('keydown', handleEditorKeydown)
})

onUnmounted(async () => {
  // 解绑 EditorPool：销毁所有编辑器实例，清除 wrapper 引用
  // 与 onMounted 中的 initWrapper 形成对称生命周期
  await editorCtx.detach()
  unsubscribes.forEach(unsubscribe => unsubscribe())
  window.removeEventListener('keydown', handleEditorKeydown)
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
  min-height: 0;
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
    .editor-wrapper {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }
  }

  // 源码模式样式
  &.mode-source {
    .editor-wrapper {
      flex: 1;
      overflow: hidden;
    }
  }

  // 分屏模式样式
  &.mode-split {
    .editor-wrapper {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: row;
    }
  }

  &.focus-mode {
    .editor-wrapper {
      background: var(--bg-primary);
    }
  }

  &.small-screen {
    :deep(.milkdown-block-handle) {
      display: none !important;
    }
  }
}

// ============================================================
// 多实例编辑器容器样式
// ============================================================

.editor-wrapper {
  :deep(.tab-editor-container) {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;

    // WYSIWYG 模式
    &.mode-wysiwyg {
      flex-direction: column;
    }

    // 分屏模式
    &.mode-split {
      flex-direction: row;

      .tab-editor-crepe {
        order: 3;
      }

      .tab-editor-splitter {
        order: 2;
      }

      .tab-editor-cm {
        order: 1;
      }
    }
  }

  :deep(.tab-editor-crepe) {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;

    &::-webkit-scrollbar {
      width: calc(var(--scrollbar-size, 8px) * 1.5);
    }

    .crepe {
      display: block;
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      transform-origin: top center;
      transform: scale(var(--editor-scale, 1));
    }

    .milkdown {
      display: block;
      height: auto;
    }

    .ProseMirror {
      outline: none;
      padding: 16px 16px !important;

      @media (min-width: 768px) {
        padding: 20px 32px !important;
      }

      @media (min-width: 1024px) {
        padding: 20px 64px !important;
      }
    }

    .milkdown-block-handle {
      display: none !important;
    }
  }

  :deep(.tab-editor-cm) {
    height: 100%;
    width: 100%;
    overflow: hidden;

    .codemirror-editor {
      height: 100%;
      width: 100%;
    }

    .cm-editor {
      height: 100%;
    }

    .cm-scroller {
      overflow: auto;

      &::-webkit-scrollbar {
        width: calc(var(--scrollbar-size, 8px) * 1.5);
      }
    }

    .cm-content {
      padding: 16px 16px !important;

      @media (min-width: 768px) {
        padding: 20px 32px !important;
      }

      @media (min-width: 1024px) {
        padding: 20px 64px !important;
      }
    }
  }

  :deep(.tab-editor-splitter) {
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

    .tab-editor-splitter-handle {
      width: 2px;
      height: 30px;
      background: var(--text-secondary);
      border-radius: 1px;
    }
  }
}
</style>
