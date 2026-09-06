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
 * **完全独立**：不依赖 CodeMirrorEditor 或 codemirror/setup.ts。
 * 源码模式（CodeMirrorEditor）以后加任何 markdown 专属特性
 * （行内公式预览、wiki link、@mention 等）都不会影响这里。
 * 隔离代价：~30 行重复的"创建 EditorView + 主题切换"样板，可接受。
 *
 * 状态持久化：cursor / scrollTop 存到 `tab.viewerState.text`。
 * 与 markdown tab 的 `tab.crepe` / `tab.codeMirror` 字段解耦，按
 * descriptor.id（'text'）命名空间隔离。未来 PDF/视频 viewer 各自往
 * `viewerState.pdf` / `viewerState.video` 存自己的状态。
 *
 * 见 [[alhagi-auxiliary-features]]。
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { search, highlightSelectionMatches } from '@codemirror/search'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'

import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { CodeMirrorSearchService, codeMirrorSearchHighlight } from '@/services/search'

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
const prefsStore = usePreferencesStore()

const editorRef = ref<HTMLElement | null>(null)
let view: EditorView | null = null
const searchManager = new CodeMirrorSearchService(() => view)

const themeCompartment = new Compartment()

/**
 * Transaction 标注：标记由"外部 modelValue 同步"驱动的 dispatch
 * （切 tab、saveAs 等），与"用户在编辑器里敲键盘"区分开。
 *
 * updateListener 看到带此标注的 transaction 就**不再** emit('update:modelValue')，
 * 避免把外部输入当成用户编辑触发 isDirty。
 */
const ExternalChange = Annotation.define<boolean>()

const isDark = computed(() => {
  if (prefsStore.theme === 'dark') return true
  if (prefsStore.theme === 'system') {
    return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  }
  return false
})

function getTheme(): Extension {
  return isDark.value ? githubDark : githubLight
}

/**
 * 纯文本视图自己的扩展集 —— 故意不引入 markdown / lang-* 包。
 * 想给 .json / .yaml 加按扩展名动态选语言时，在这里加 import + 选择即可，
 * 不会污染源码模式（markdown 编辑器）。
 */
function buildExtensions(): Extension[] {
  return [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    search(),
    codeMirrorSearchHighlight(),
    highlightSelectionMatches(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    themeCompartment.of(getTheme()),
    EditorView.updateListener.of((update) => {
      if (update.focusChanged) {
        if (update.view.hasFocus) emit('focus')
        else emit('blur')
      }
      // 严格仅 doc 变化才上报，避免点击/滚动误标 isDirty。
      // 同时跳过"外部同步"产生的变更（切 tab 时父组件 modelValue 变化触发的
      // dispatch），它们带有 ExternalChange 标注 —— 不是用户编辑。
      if (update.docChanged) {
        const fromExternal = update.transactions.some(
          (tr) => tr.annotation(ExternalChange) === true,
        )
        if (!fromExternal) {
          emit('update:modelValue', update.state.doc.toString())
        }
      }
    }),
  ]
}

function getViewerState(tabId = props.tabId): { cursor?: { from: number; to: number }; scrollTop?: number } {
  if (!tabId) return {}
  const tab = tabsStore.getTab(tabId)
  const raw = tab?.viewerState?.text
  if (!raw || typeof raw !== 'object') return {}
  return raw as { cursor?: { from: number; to: number }; scrollTop?: number }
}

function persistViewerState(tabId = props.tabId): void {
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
      if (view) view.scrollDOM.scrollTop = saved.scrollTop ?? 0
    })
  }
}

function createView(content: string) {
  if (!editorRef.value) return
  view = new EditorView({
    state: EditorState.create({
      doc: content,
      extensions: buildExtensions(),
    }),
    parent: editorRef.value,
  })

  // 恢复光标 / 滚动
  restoreViewerState()

  // mount 后自动 focus —— 避免用户打开 .txt 后看不到光标
  view.focus()
}

function destroyView() {
  if (!view) return
  searchManager.clear()
  persistViewerState()
  view.destroy()
  view = null
}

onMounted(() => {
  createView(props.modelValue)
})

onUnmounted(() => {
  destroyView()
})

// 主题动态切换
watch(isDark, () => {
  if (!view) return
  view.dispatch({
    effects: themeCompartment.reconfigure(getTheme()),
  })
})

// 外部更新（切 tab / saveAs / 其它窗口同步等）→ 同步进 EditorView。
//
// 注意：PlainTextEditor 作为 dynamic viewer 会在多个 text tab 之间**复用同一个组件实例**。
// 因此 tabId 变化时必须：
//   1. 先保存旧 tab 的 viewerState.text
//   2. 用新 modelValue 替换当前 CodeMirror doc（带 ExternalChange，避免误标 isDirty）
//   3. 下一帧恢复新 tab 的 cursor / scrollTop
watch(
  () => ({ tabId: props.tabId, content: props.modelValue }),
  (next, prev) => {
    if (!view) return

    if (prev?.tabId && prev.tabId !== next.tabId) {
      persistViewerState(prev.tabId)
    }

    const cur = view.state.doc.toString()
    if (cur !== next.content) {
      view.dispatch({
        changes: { from: 0, to: cur.length, insert: next.content },
        annotations: ExternalChange.of(true),
      })
    }

    if (prev?.tabId !== next.tabId) {
      restoreViewerState(next.tabId)
    }
  },
)

defineExpose({
  search: searchManager.search.bind(searchManager),
  clearSearch: searchManager.clear.bind(searchManager),
  findNext: searchManager.findNext.bind(searchManager),
  findPrev: searchManager.findPrev.bind(searchManager),
  replaceNext: searchManager.replaceNext.bind(searchManager),
  replaceAll: searchManager.replaceAll.bind(searchManager),
})
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
