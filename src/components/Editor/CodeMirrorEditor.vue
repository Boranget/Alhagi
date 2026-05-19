<template>
  <div
    ref="editorRef"
    class="codemirror-editor"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorView } from '@codemirror/view'
import { createCodeMirrorView, createCodeMirrorState } from './codemirror/setup'

interface Props {
  modelValue: string
  dark?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  dark: false
})

const emit = defineEmits(['update:modelValue'])

const editorRef = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null

const handleChange = (getString: () => string) => {
  const newValue = getString()
  emit('update:modelValue', newValue)
}

onMounted(() => {
  if (editorRef.value) {
    editorView = createCodeMirrorView({
      root: editorRef.value,
      content: props.modelValue,
      dark: props.dark,
      onChange: handleChange
    })
  }
})

onUnmounted(() => {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
})

watch(() => props.modelValue, (newValue) => {
  if (editorView && editorView.state.doc.toString() !== newValue) {
    const state = createCodeMirrorState({
      content: newValue,
      dark: props.dark,
      onChange: handleChange
    })
    editorView.setState(state)
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
