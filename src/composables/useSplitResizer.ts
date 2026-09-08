import { ref, onMounted, onUnmounted } from 'vue'

const SPLIT_MIN = 20
const SPLIT_MAX = 80

export function useSplitResizer(containerSelector = '.editor-content.mode-split') {
  const splitRatio = ref(50)
  const isResizing = ref(false)

  function handleMouseDown(_e: MouseEvent) {
    isResizing.value = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isResizing.value) return

    const container = document.querySelector(containerSelector) as HTMLElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    let newRatio = ((e.clientX - rect.left) / rect.width) * 100
    newRatio = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, newRatio))
    splitRatio.value = newRatio
  }

  function handleMouseUp() {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  })

  return {
    splitRatio,
    isResizing,
    handleResizerMouseDown: handleMouseDown,
  }
}
