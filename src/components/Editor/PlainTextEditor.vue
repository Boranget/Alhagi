<template>
  <div
    ref="editorRef"
    class="plain-text-editor"
  />
</template>

<script setup lang="ts">
/**
 * PlainTextEditor —— 纯文本可编辑视图（辅助功能 viewer）。
 *
 * 建立在 useCmDocumentView 底座上：EditorView 生命周期 / 主题 / 搜索 /
 * 外部同步标注全部来自底座，本组件只保留 text viewer 特有的两件事：
 *   1. viewerState.text 的光标 / 滚动持久化（按 descriptor id 命名空间隔离，
 *      未来 PDF / 视图类 viewer 各存自己的 viewerState.<id>）
 *   2. tab 切换时的状态保存 / 恢复编排
 *
 * 见 [[alhagi-auxiliary-features]]。
 */

import { watch, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useCmDocumentView } from './codemirror/useCmDocumentView'
import { ExternalChange } from './codemirror/shared'
import { useViewerSearchSlot } from '@/composables/useSearch'

interface Props {
  modelValue: string
  /** 当前 tab id；用来读写 viewerState.text 持久化光标/滚动 */
  tabId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const tabsStore = useTabsStore()

// EditorContainer 提供的 viewer 搜索槽：挂载注册、卸载注销，
// Ctrl+F 据此路由到本组件的 searchManager（无提供者时为一次性 ref，静默 no-op）。
const searchSlot = useViewerSearchSlot()

const { editorRef, createView, destroyView, syncContent, getView, searchManager } = useCmDocumentView({
  onUserChange: (content) => emit('update:modelValue', content),
  onFocus: () => emit('focus'),
  onBlur: () => emit('blur'),
})

function getViewerState(tabId = props.tabId): { cursor?: { from: number; to: number }; scrollTop?: number } {
  if (!tabId) return {}
  const tab = tabsStore.getTab(tabId)
  const raw = tab?.viewerState?.text
  if (!raw || typeof raw !== 'object') return {}
  return raw as { cursor?: { from: number; to: number }; scrollTop?: number }
}

function persistViewerState(tabId = props.tabId): void {
  const view = getView()
  if (!tabId || !view) return
  const tab = tabsStore.getTab(tabId)
  if (!tab) return
  const sel = view.state.selection.main
  const scroller = view.scrollDOM
  const next = {
    cursor: { from: sel.from, to: sel.to },
    scrollTop: scroller.scrollTop,
  }
  tabsStore.updateTab(tabId, {
    viewerState: { ...(tab.viewerState ?? {}), text: next },
  })
}

function restoreViewerState(tabId = props.tabId): void {
  const view = getView()
  if (!view) return
  const saved = getViewerState(tabId)
  if (saved.cursor) {
    const docLen = view.state.doc.length
    const from = Math.min(saved.cursor.from, docLen)
    const to = Math.min(saved.cursor.to, docLen)
    try {
      // selection 恢复是外部驱动，不是用户编辑；带标注保持语义一致。
      view.dispatch({
        selection: { anchor: from, head: to },
        annotations: ExternalChange.of(true),
      })
    } catch {
      /* 文档长度变化导致的恢复失败静默 */
    }
  }
  if (typeof saved.scrollTop === 'number') {
    requestAnimationFrame(() => {
      const v = getView()
      if (v) v.scrollDOM.scrollTop = saved.scrollTop ?? 0
    })
  }
}

onMounted(() => {
  createView(props.modelValue)
  // 恢复光标 / 滚动
  restoreViewerState()
  // mount 后自动 focus —— 避免用户打开 .txt 后看不到光标
  getView()?.focus()
  searchSlot.value = searchManager
})

onUnmounted(() => {
  // 先注销再销毁：注销带回环保护，不覆盖已被其它实例接管的槽位。
  // 槽位是 shallowRef —— ref() 会把对象值包成 reactive proxy，
  // proxy !== 原实例导致这里的 === 回环保护失效。
  if (searchSlot.value === searchManager) searchSlot.value = null
  persistViewerState()
  destroyView()
})

// 外部更新（切 tab / saveAs / 其它窗口同步等）→ 同步进 EditorView。
//
// 注意：PlainTextEditor 作为 dynamic viewer 会在多个 text tab 之间**复用同一个组件实例**。
// 因此 tabId 变化时必须：
//   1. 先保存旧 tab 的 viewerState.text
//   2. 用新 modelValue 替换当前 CodeMirror doc（底座 syncContent 带 ExternalChange，避免误标 isDirty）
//   3. 恢复新 tab 的 cursor / scrollTop
watch(
  () => ({ tabId: props.tabId, content: props.modelValue }),
  (next, prev) => {
    if (!getView()) return

    if (prev?.tabId && prev.tabId !== next.tabId) {
      persistViewerState(prev.tabId)
    }

    syncContent(next.content)

    if (prev?.tabId !== next.tabId) {
      restoreViewerState(next.tabId)
    }
  },
)
</script>

<style scoped lang="scss">
.plain-text-editor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* CodeMirror 默认在 .cm-editor 上没设 height: 100%，需要手动撑开。
     选择器与 main.scss 里源码模式（.codemirror-editor .cm-editor .cm-scroller）
     互不冲突 —— 那边作用于 .codemirror-editor，这里作用于 .plain-text-editor。 */
  :deep(.cm-editor) {
    height: 100%;
  }

  :deep(.cm-scroller) {
    overflow: auto;
  }
}
</style>
