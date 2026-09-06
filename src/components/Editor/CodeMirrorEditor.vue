<template>
  <div
    ref="editorRef"
    class="codemirror-editor"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { createCodeMirrorView, updateEditorTheme, updateEditorTypography, EditorView, ExternalChange, type ThemeType } from './codemirror/setup'
import { CodeMirrorSearchService } from '@/services/search'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useLayoutStore } from '@/stores/layout'

interface Props {
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const layoutStore = useLayoutStore()

const editorRef = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null
const searchManager = new CodeMirrorSearchService(() => editorView)

const isDarkMode = computed<ThemeType>(() => {
  if (prefsStore.theme === 'dark') return 'dark'
  if (prefsStore.theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
})

const handleChange = (getString: () => string) => {
  const newValue = getString()
  emit('update:modelValue', newValue)
}

const handleFocus = () => {
  emit('focus')
}

const handleBlur = () => {
  emit('blur')
}

function emitCursorChange() {
  if (!editorView) return
  const tabId = tabsStore.activeTab?.id
  if (!tabId) return
  const { from, to } = editorView.state.selection.main
  eventBus.emit(AppEvents.CURSOR_CHANGED, { from, to, tabId })
}

/**
 * 获取当前编辑器状态（光标位置和滚动位置）
 * 用于在标签页切换时保存编辑器的当前状态
 */
function getCurrentState() {
  if (!editorView) {
    return { cursor: { from: 0, to: 0 }, scrollTop: 0 }
  }

  const { from, to } = editorView.state.selection.main
  
  // 获取滚动容器的 scrollTop
  // editorView.dom 是 .cm-editor，.cm-scroller 是它的子元素
  let scrollTop = 0
  const scrollContainer = editorView.dom.querySelector('.cm-scroller') as HTMLElement
  if (scrollContainer) {
    scrollTop = scrollContainer.scrollTop
  }

  return { cursor: { from, to }, scrollTop }
}

/**
 * 恢复编辑器状态（光标位置和滚动位置）
 * 用于在标签页切换后恢复之前保存的编辑器状态
 * @param cursor - 光标位置 { from, to }
 * @param scrollTop - 滚动位置
 */
function restoreState(cursor: { from: number; to: number }, scrollTop: number) {
  if (!editorView) return

  // 恢复滚动位置
  // editorView.dom 是 .cm-editor，.cm-scroller 是它的子元素
  const scrollContainer = editorView.dom.querySelector('.cm-scroller') as HTMLElement
  if (scrollContainer && scrollTop >= 0) {
    scrollContainer.scrollTop = scrollTop
  }

  // 恢复光标位置
  if (cursor && cursor.from >= 0 && cursor.to >= 0) {
    const docLength = editorView.state.doc.length
    const from = Math.min(cursor.from, docLength)
    const to = Math.min(cursor.to, docLength)
    
    try {
      editorView.dispatch({
        selection: { anchor: from, head: to }
      })
    } catch {
      // 忽略光标恢复错误（可能文档长度变化）
    }
  }
}

function initEditor() {
  if (editorRef.value) {
    editorView = createCodeMirrorView({
      root: editorRef.value,
      content: props.modelValue,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onSelectionChange: emitCursorChange,
      theme: isDarkMode.value,
    })
  }
}

function destroyEditor() {
  if (editorView) {
    searchManager.clear()
    editorView.destroy()
    editorView = null
  }
}

function handleThemeChange(newTheme: ThemeType) {
  if (editorView) {
    updateEditorTheme(editorView, newTheme)
  }
}

onMounted(() => {
  initEditor()
})

onUnmounted(() => {
  destroyEditor()
})

watch(isDarkMode, (newTheme) => {
  handleThemeChange(newTheme)
})

watch(() => layoutStore.isStickyNoteMode, () => {
  if (editorView) updateEditorTypography(editorView)
})

watch(() => props.modelValue, (newValue) => {
  if (editorView && editorView.state.doc.toString() !== newValue) {
    const currentDoc = editorView.state.doc
    const currentLength = currentDoc.length
    const newLength = newValue.length

    const selection = editorView.state.selection.main
    const from = Math.min(selection.from, newLength)
    const to = Math.min(selection.to, newLength)

    // 带 ExternalChange 标注 —— 这是"切 tab / 保存反馈" 等外部驱动的同步，
    // 不是用户编辑。updateListener 据此跳过 onChange，避免误标 isDirty。
    editorView.dispatch({
      changes: {
        from: 0,
        to: currentLength,
        insert: newValue
      },
      selection: {
        anchor: from,
        head: to
      },
      annotations: ExternalChange.of(true),
    })
  }
})

// 暴露方法供父组件调用
defineExpose({
  getCurrentState,
  restoreState,
  search: searchManager.search.bind(searchManager),
  clearSearch: searchManager.clear.bind(searchManager),
  findNext: searchManager.findNext.bind(searchManager),
  findPrev: searchManager.findPrev.bind(searchManager),
  replaceNext: searchManager.replaceNext.bind(searchManager),
  replaceAll: searchManager.replaceAll.bind(searchManager),
})
</script>

<style scoped lang="scss">
.codemirror-editor {
  height: 100%;
  width: 100%;
  overflow: hidden;

  :deep(.cm-editor) {
    height: 100%;
  }

  :deep(.cm-scroller) {
    overflow: auto;
  }
}
</style>
