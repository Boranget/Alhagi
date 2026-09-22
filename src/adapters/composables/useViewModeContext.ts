import { storeToRefs } from 'pinia'
import { useViewModeStore } from '@/stores/viewMode'
import { useWritingEnhancement } from '@/adapters/composables/useWritingEnhancement'

export function useViewModeContext() {
  const store = useViewModeStore()
  const { typewriterMode, focusMode } = storeToRefs(store)

  return {
    typewriterMode,
    focusMode,
    toggleTypewriterMode: () => {
      const { toggleTypewriterMode } = useWritingEnhancement()
      toggleTypewriterMode()
    },
    toggleFocusMode: () => {
      const { toggleFocusMode } = useWritingEnhancement()
      toggleFocusMode()
    },
    setTypewriterMode: store.setTypewriterMode,
    setFocusMode: store.setFocusMode,
  }
}

export type ViewModeContext = ReturnType<typeof useViewModeContext>
