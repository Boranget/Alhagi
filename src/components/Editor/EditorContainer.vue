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
      <!-- 主编辑器外壳（Crepe + CodeMirror）始终保留在 DOM 中（v-show）——
           切到辅助 viewer 后不卸载，切回 markdown 无需重建实例。
           辅助 viewer（text / image / unsupported）作为绝对定位覆盖层渲染在上方。 -->
      <div
        v-show="useEditorShell"
        ref="editorWrapper"
        class="editor-wrapper"
      />

      <!-- 辅助 viewer 覆盖层：descriptor.viewer 非 null 时挂载。
           canSave 决定是否双向绑定 model-value；tabId 透传，
           viewer 可往 tab.viewerState[descriptor.id] 持久化私有状态。 -->
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
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useTabsStore } from '@/stores/tabs'
import { useViewModeStore } from '@/stores/viewMode'
import { useEditorContext } from '@adapters/composables/useEditorContext'
import { eventBus, AppEvents } from '@adapters/composables/useEventBus'
import { EDITOR } from '@/constants'
import type { ViewMode } from '@/types'
import FloatingSearch from './FloatingSearch.vue'
import { getDescriptor, detectDescriptor, type FileTypeDescriptor } from '@/fileTypes'
import { provideSearchService, provideViewerSearchSlot } from '@/composables/useSearch'
import { CrepeSearchService } from '@/services/search'
import type { SearchService, SearchResult, ReplaceResult } from '@/services/search'
import type { SearchConfig } from '@/utils/search'
import { useResponsiveEditor } from '@/composables/useResponsiveEditor'

const tabsStore = useTabsStore()
const viewModeStore = useViewModeStore()
const { activeTab } = storeToRefs(tabsStore)
const { typewriterMode, focusMode } = storeToRefs(viewModeStore)
const editorCtx = useEditorContext()
const { windowWidth, isSmallScreen, editorScale } = useResponsiveEditor()

const editorWrapper = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

const currentMode = ref<ViewMode>('wysiwyg')
const unsubscribes: (() => void)[] = []

/**
 * 当前 tab 对应的 descriptor —— 渲染分支的单一事实源。
 *   - editor（viewer === null）→ 主编辑器外壳（Crepe + CodeMirror）
 *   - 其它（text / image / unsupported）→ descriptor.viewer 覆盖层
 *
 * 欢迎页（无 activeTab / 无 filePath）→ 默认按 editor 处理，让 Crepe 挂载占位。
 */
const currentDescriptor = computed<FileTypeDescriptor>(() => {
  if (!activeTab.value) return detectDescriptor(null)
  return getDescriptor(activeTab.value.fileType) ?? detectDescriptor(activeTab.value.filePath)
})

/** 使用主编辑器外壳的条件：descriptor 没有自己的 viewer。 */
const useEditorShell = computed(() => currentDescriptor.value.viewer === null)

/**
 * viewer 搜索注册槽：辅助 viewer 挂载时注册 searchManager、卸载时注销。
 * 无 viewer 注册（image / unsupported）时为 null，Ctrl+F 静默无效。
 * shallowRef：service 是类实例，不深度代理（ref 会包 proxy 破坏 === 保护与 private field）。
 */
const viewerSearchSlot = shallowRef<SearchService | null>(null)
provideViewerSearchSlot(viewerSearchSlot)

const searchService = computed(() => {
  // 辅助 viewer tab：搜索路由到 viewer 注册的服务，而非被覆盖层遮住的主编辑器
  if (!useEditorShell.value) return viewerSearchSlot.value
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

// activeTab 是原地 mutate 的同一对象引用（updateTab 走 Object.assign），
// watch 只盯对象身份会在 save-as 改扩展名（fileType 变化）时漏触发，
// 故把 currentDescriptor 一并作为 watch 源（descriptor 引用随 fileType 变化）。
watch([activeTab, currentDescriptor], async ([tab]) => {
  if (!tab) {
    return
  }

  // 仅 markdown 主编辑器 tab 参与 EditorPool 链路。
  // 辅助 tab（text / image / unsupported）完全不动 Crepe/CM：
  //   - 它们的 content 是纯文本或空，不能灌给 markdown 解析器
  //   - 灌进去会触发 docChanged 误标 isDirty
  if (currentDescriptor.value.id !== 'editor') {
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
  // 辅助 viewer tab 没有 viewMode 概念
  if (currentDescriptor.value.id !== 'editor') return

  // 切换模式时自动关闭搜索框
  floatingSearchRef.value?.hide()

  // 更新模式
  currentMode.value = mode
  editorCtx.setTabViewMode(activeTab.value.id, mode)
  tabsStore.updateTab(activeTab.value.id, { viewMode: mode })

  // 等待 DOM 更新
  await nextTick()
}

/**
 * 辅助 viewer 内容变化（仅 canSave=true 的 viewer 触发，如 PlainTextEditor）。
 * 写回 store + 标脏；不走 editorManager/Crepe 链路，辅助 tab 不参与主编辑器。
 * 随后发 CONTENT_CHANGED —— 与 markdown 链路（pool onContentChange）对齐：
 * 搜索高亮实时刷新 + 自动保存调度对 txt tab 同样生效。
 */
function handleViewerChange(content: string) {
  if (!activeTab.value) return
  const tabId = activeTab.value.id
  tabsStore.updateTab(tabId, { content, isDirty: true })
  eventBus.emit(AppEvents.CONTENT_CHANGED, { content, tabId })
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

  // CONTENT_CHANGED / CURSOR_CHANGED 由组合根统一桥接（见 bridgeEditorEvents）：
  // 池级回调 → 事件总线，随挂载/卸载反复注册会造成漏配或重复发送。

  // 关闭的 tab 立即释放编辑器实例（Crepe/CM/DOM），否则每次关闭都泄漏
  unsubscribes.push(
    eventBus.on(AppEvents.TAB_CLOSED, ({ tabId }) => {
      void editorCtx.destroyTab(tabId)
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

  /* 打字机模式：编辑区上下 40vh 留白，让光标停在视口中部。
   * 必须在 scoped 里写：组件内 .tab-editor-crepe/.tab-editor-cm 的
   * padding 规则特异性（0,4,0）压过 body.typewriter-mode 全局规则
   * （0,2,1），全局 40vh 永远不生效 —— 这正是打字机"不生效"的成因之一。
   * .editor-content.typewriter-mode 钩子来自 contentClasses。 */
  &.typewriter-mode {
    :deep(.tab-editor-crepe) {
      .ProseMirror {
        padding-top: 40vh !important;
        padding-bottom: 40vh !important;
      }
    }

    // 源码/分屏 CM：仅容器级 cm-content（代码块内 CM 不在 .tab-editor-cm 下，天然排除）
    :deep(.tab-editor-cm) {
      .cm-content {
        padding-top: 40vh !important;
        padding-bottom: 40vh !important;
      }
    }
  }
}

/* 辅助 viewer 覆盖层（image / text / unsupported / 未来 PDF 等）。
 * :deep() 是因为 viewer 是 dynamic <component>，class 落在子组件根元素上，
 * scoped CSS 需穿透才能命中。
 * 同一时刻只有一个 viewer 在挂载（v-if 保证），z-index 不会冲突。 */
:deep(.viewer-overlay) {
  position: absolute;
  inset: 0;
  z-index: 5;
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
