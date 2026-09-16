import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useWritingEnhancement, resetWritingEnhancementInstance } from '@/adapters/composables/useWritingEnhancement'
import { useViewModeStore } from '@/stores/viewMode'

// Mock the crepeEditorManager
vi.mock('@/managers/crepeEditorManager', () => ({
  useCrepeEditorManager: vi.fn(() => ({
    getActiveEditor: vi.fn(() => 'crepe'),
    getView: vi.fn(() => null),
  })),
}))

describe('useWritingEnhancement', () => {
  beforeEach(() => {
    resetWritingEnhancementInstance()
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    document.body.classList.remove('typewriter-mode', 'focus-mode')
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    document.body.classList.remove('typewriter-mode', 'focus-mode')
  })

  describe('toggleTypewriterMode', () => {
    it('should toggle typewriter mode via store', () => {
      const store = useViewModeStore()
      const { toggleTypewriterMode } = useWritingEnhancement()

      expect(store.typewriterMode).toBe(false)
      toggleTypewriterMode()
      expect(store.typewriterMode).toBe(true)
      toggleTypewriterMode()
      expect(store.typewriterMode).toBe(false)
    })
  })

  describe('toggleFocusMode', () => {
    it('should toggle focus mode via store', () => {
      const store = useViewModeStore()
      const { toggleFocusMode } = useWritingEnhancement()

      expect(store.focusMode).toBe(false)
      toggleFocusMode()
      expect(store.focusMode).toBe(true)
      toggleFocusMode()
      expect(store.focusMode).toBe(false)
    })
  })

  describe('applyTypewriterMode (via store watcher)', () => {
    it('should add typewriter-mode class to body when enabled', async () => {
      const store = useViewModeStore()
      const { initialize } = useWritingEnhancement()

      initialize()
      store.setTypewriterMode(true)
      await nextTick()

      expect(document.body.classList.contains('typewriter-mode')).toBe(true)
    })

    it('should remove typewriter-mode class from body when disabled', async () => {
      const store = useViewModeStore()
      const { initialize } = useWritingEnhancement()

      initialize()
      store.setTypewriterMode(true)
      await nextTick()
      store.setTypewriterMode(false)
      await nextTick()

      expect(document.body.classList.contains('typewriter-mode')).toBe(false)
    })
  })

  describe('applyFocusMode (via store watcher)', () => {
    it('should add focus-mode class to body when enabled', async () => {
      const store = useViewModeStore()
      const { initialize } = useWritingEnhancement()

      initialize()
      store.setFocusMode(true)
      await nextTick()

      expect(document.body.classList.contains('focus-mode')).toBe(true)
    })

    it('should remove focus-mode class from body when disabled', async () => {
      const store = useViewModeStore()
      const { initialize } = useWritingEnhancement()

      initialize()
      store.setFocusMode(true)
      await nextTick()
      store.setFocusMode(false)
      await nextTick()

      expect(document.body.classList.contains('focus-mode')).toBe(false)
    })
  })

  describe('initialize', () => {
    it('should be idempotent', () => {
      const { initialize } = useWritingEnhancement()

      initialize()
      initialize()
      initialize()
    })

    it('should restore state on initialization', async () => {
      const store = useViewModeStore()
      const { initialize } = useWritingEnhancement()

      store.setTypewriterMode(true)
      store.setFocusMode(true)

      initialize()
      await nextTick()

      expect(document.body.classList.contains('typewriter-mode')).toBe(true)
      expect(document.body.classList.contains('focus-mode')).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should remove all CSS classes from body', async () => {
      const store = useViewModeStore()
      const { initialize, cleanup } = useWritingEnhancement()

      initialize()
      store.setTypewriterMode(true)
      store.setFocusMode(true)
      await nextTick()

      cleanup()

      expect(document.body.classList.contains('typewriter-mode')).toBe(false)
      expect(document.body.classList.contains('focus-mode')).toBe(false)
    })
  })
})
