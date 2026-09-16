import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useViewModeStore } from '../viewMode'

describe('viewMode store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('typewriterMode', () => {
    it('should default to false', () => {
      const store = useViewModeStore()
      expect(store.typewriterMode).toBe(false)
    })

    it('should set typewriterMode via setter', () => {
      const store = useViewModeStore()

      store.setTypewriterMode(true)
      expect(store.typewriterMode).toBe(true)

      store.setTypewriterMode(false)
      expect(store.typewriterMode).toBe(false)
    })
  })

  describe('focusMode', () => {
    it('should default to false', () => {
      const store = useViewModeStore()
      expect(store.focusMode).toBe(false)
    })

    it('should set focusMode via setter', () => {
      const store = useViewModeStore()

      store.setFocusMode(true)
      expect(store.focusMode).toBe(true)

      store.setFocusMode(false)
      expect(store.focusMode).toBe(false)
    })
  })

  describe('independence', () => {
    it('typewriterMode and focusMode should be independent', () => {
      const store = useViewModeStore()

      store.setTypewriterMode(true)
      store.setFocusMode(false)
      expect(store.typewriterMode).toBe(true)
      expect(store.focusMode).toBe(false)

      store.setFocusMode(true)
      expect(store.typewriterMode).toBe(true)
      expect(store.focusMode).toBe(true)

      store.setTypewriterMode(false)
      expect(store.typewriterMode).toBe(false)
      expect(store.focusMode).toBe(true)
    })
  })
})
