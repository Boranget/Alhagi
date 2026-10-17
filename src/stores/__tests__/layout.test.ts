import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../layout'

describe('Layout Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('electronAPI', {
      layoutChanged: vi.fn().mockResolvedValue(undefined),
    })
  })

  describe('initial state', () => {
    it('should default all panels to visible', () => {
      const store = useLayoutStore()
      expect(store.showSidebar).toBe(true)
      expect(store.showTabBar).toBe(true)
      expect(store.showStatusBar).toBe(true)
      expect(store.isStickyNoteMode).toBe(false)
      expect(store.isImmersiveMode).toBe(false)
    })
  })

  describe('setSidebar / setTabBar / setStatusBar', () => {
    it('should toggle sidebar', () => {
      const store = useLayoutStore()
      store.setSidebar(false)
      expect(store.showSidebar).toBe(false)
      store.setSidebar(true)
      expect(store.showSidebar).toBe(true)
    })

    it('should toggle tabBar', () => {
      const store = useLayoutStore()
      store.setTabBar(false)
      expect(store.showTabBar).toBe(false)
    })

    it('should toggle statusBar', () => {
      const store = useLayoutStore()
      store.setStatusBar(false)
      expect(store.showStatusBar).toBe(false)
    })

    it('should not emit IPC if value unchanged (dedup)', () => {
      const store = useLayoutStore()
      store.setSidebar(true)
      expect(window.electronAPI?.layoutChanged).not.toHaveBeenCalled()
    })
  })

  describe('toggle methods', () => {
    it('should toggle sidebar', () => {
      const store = useLayoutStore()
      expect(store.showSidebar).toBe(true)
      store.toggleSidebar()
      expect(store.showSidebar).toBe(false)
      store.toggleSidebar()
      expect(store.showSidebar).toBe(true)
    })
  })

  describe('setAll', () => {
    it('should set all three panels at once', () => {
      const store = useLayoutStore()
      store.setAll(false, false, false)
      expect(store.showSidebar).toBe(false)
      expect(store.showTabBar).toBe(false)
      expect(store.showStatusBar).toBe(false)
    })
  })

  describe('applyWindowMode', () => {
    it('should set normal mode (all visible)', () => {
      const store = useLayoutStore()
      store.applyWindowMode('normal')
      expect(store.showSidebar).toBe(true)
      expect(store.showTabBar).toBe(true)
      expect(store.showStatusBar).toBe(true)
      expect(store.isStickyNoteMode).toBe(false)
      expect(store.isImmersiveMode).toBe(false)
    })

    it('should set sticky mode (all hidden)', () => {
      const store = useLayoutStore()
      store.applyWindowMode('sticky')
      expect(store.showSidebar).toBe(false)
      expect(store.isStickyNoteMode).toBe(true)
    })

    it('should set immersive mode (all hidden)', () => {
      const store = useLayoutStore()
      store.applyWindowMode('immersive')
      expect(store.showSidebar).toBe(false)
      expect(store.isImmersiveMode).toBe(true)
    })
  })

  describe('setStickyNoteMode', () => {
    it('should enable sticky mode and hide panels', () => {
      const store = useLayoutStore()
      store.setStickyNoteMode(true)
      expect(store.isStickyNoteMode).toBe(true)
      expect(store.isImmersiveMode).toBe(false)
      expect(store.showSidebar).toBe(false)
    })

    it('should disable sticky mode and restore panels', () => {
      const store = useLayoutStore()
      store.setStickyNoteMode(true)
      store.setStickyNoteMode(false)
      expect(store.isStickyNoteMode).toBe(false)
      expect(store.showSidebar).toBe(true)
    })
  })

  describe('restoreDefaults', () => {
    it('should restore all panels to visible', () => {
      const store = useLayoutStore()
      store.setAll(false, false, false)
      store.restoreDefaults()
      expect(store.showSidebar).toBe(true)
      expect(store.showTabBar).toBe(true)
      expect(store.showStatusBar).toBe(true)
    })
  })
})
