import { ref, computed } from 'vue'
import { EDITOR } from '@/constants'
import type { ViewMode } from '@/types'

export function useEditorView() {
  const currentMode = ref<ViewMode>('wysiwyg')
  const splitRatio = ref(50)
  const isResizing = ref(false)
  const windowWidth = ref(window.innerWidth)
  const windowHeight = ref(window.innerHeight)

  const isWysiwygMode = computed(() => currentMode.value === EDITOR.VIEW_MODES.WYSIWYG)
  const isSourceMode = computed(() => currentMode.value === EDITOR.VIEW_MODES.SOURCE)
  const isSplitMode = computed(() => currentMode.value === EDITOR.VIEW_MODES.SPLIT)

  const isSmallScreen = computed(() => windowWidth.value < 800)
  const editorScale = computed(() => {
    if (windowWidth.value < 600) return 0.8
    if (windowWidth.value < 1000) return 0.9
    return 1
  })

  return {
    currentMode,
    splitRatio,
    isResizing,
    windowWidth,
    windowHeight,
    isWysiwygMode,
    isSourceMode,
    isSplitMode,
    isSmallScreen,
    editorScale
  }
}
