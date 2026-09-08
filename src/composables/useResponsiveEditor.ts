import { ref, computed, onMounted, onUnmounted } from 'vue'

const SMALL_SCREEN_BREAKPOINT = 800
const SCALE_SMALL_BREAKPOINT = 600
const SCALE_MEDIUM_BREAKPOINT = 1000

export function useResponsiveEditor() {
  const windowWidth = ref(window.innerWidth)

  const isSmallScreen = computed(() => windowWidth.value < SMALL_SCREEN_BREAKPOINT)

  const editorScale = computed(() => {
    if (windowWidth.value < SCALE_SMALL_BREAKPOINT) return 0.8
    if (windowWidth.value < SCALE_MEDIUM_BREAKPOINT) return 0.9
    return 1
  })

  function handleResize() {
    windowWidth.value = window.innerWidth
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return { windowWidth, isSmallScreen, editorScale }
}
