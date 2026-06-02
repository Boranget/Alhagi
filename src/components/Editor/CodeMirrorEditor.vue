<template>
  <div
    ref="editorRef"
    class="codemirror-editor"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { EditorView } from '@codemirror/view'
import { createCodeMirrorView } from './codemirror/setup'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useTabsStore } from '@/stores/tabs'

interface Props {
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const prefsStore = usePreferencesStore()
const tabsStore = useTabsStore()

// 计算当前是否为暗色模式
const isDarkMode = computed(() => {
  if (prefsStore.theme === 'dark') return true
  if (prefsStore.theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  }
  return false
})

const editorRef = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null

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

function initEditor() {
  if (editorRef.value) {
    editorView = createCodeMirrorView({
      root: editorRef.value,
      content: props.modelValue,
      dark: isDarkMode.value,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onSelectionChange: emitCursorChange,
    })
  }
}

function destroyEditor() {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
}

onMounted(() => {
  initEditor()
})

onUnmounted(() => {
  destroyEditor()
})

// 监听暗色模式变化，重新创建编辑器以切换主题
watch(isDarkMode, () => {
  destroyEditor()
  initEditor()
})

watch(() => props.modelValue, (newValue) => {
  if (editorView && editorView.state.doc.toString() !== newValue) {
    // 使用增量更新来保留撤销历史
    const currentDoc = editorView.state.doc
    const currentLength = currentDoc.length
    const newLength = newValue.length
    
    // 保留光标位置
    const selection = editorView.state.selection.main
    const from = Math.min(selection.from, newLength)
    const to = Math.min(selection.to, newLength)
    
    // 使用 dispatch 和 changes 来增量更新
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
