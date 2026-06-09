<template>
  <div
    ref="editorRef"
    class="codemirror-editor"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { createCodeMirrorView, updateEditorTheme, EditorView, type ThemeType } from './codemirror/setup'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'

interface Props {
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()

const editorRef = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null

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

watch(() => props.modelValue, (newValue) => {
  if (editorView && editorView.state.doc.toString() !== newValue) {
    const currentDoc = editorView.state.doc
    const currentLength = currentDoc.length
    const newLength = newValue.length
    
    const selection = editorView.state.selection.main
    const from = Math.min(selection.from, newLength)
    const to = Math.min(selection.to, newLength)
    
    editorView.dispatch({
      changes: {
        from: 0,
        to: currentLength,
        insert: newValue
      },
      selection: {
        anchor: from,
        head: to
      }
    })
  }
})

// 暴露方法供父组件调用
defineExpose({
  getCurrentState,
  restoreState
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
