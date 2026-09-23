import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ScrollServiceGateway } from '../ScrollServiceGateway'
import { eventBus, AppEvents } from '@/events/eventBus'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { ViewMode } from '@shared/types'

// ── Mock Helpers ──────────────────────────────────────

function createMockEditorProvider(overrides: Partial<IEditorProvider> = {}): IEditorProvider {
  return {
    getActiveEditor: vi.fn(() => 'crepe') as IEditorProvider['getActiveEditor'],
    getView: vi.fn(() => null),
    getSelection: vi.fn(() => null),
    getHeadings: vi.fn(() => []),
    getMarkdown: vi.fn(() => ''),
    getHTML: vi.fn(() => ''),
    destroy: vi.fn(() => Promise.resolve()),
    isReady: vi.fn(() => true),
    setViewMode: vi.fn(),
    setTabViewMode: vi.fn(),
    getViewMode: vi.fn(() => 'wysiwyg' as ViewMode),
    scrollToHeading: vi.fn(),
    onContentChange: vi.fn(() => () => {}),
    onCursorChange: vi.fn(() => () => {}),
    getCachedContent: vi.fn(() => undefined),
    setCachedContent: vi.fn(),
    clearCache: vi.fn(),
    setTabContent: vi.fn(() => Promise.resolve()),
    getCMSearchService: vi.fn(() => null),
    updateTheme: vi.fn(() => Promise.resolve()),
    // 多实例方法
    initWrapper: vi.fn(() => Promise.resolve()),
    detach: vi.fn(() => Promise.resolve()),
    createTab: vi.fn(() => Promise.resolve()),
    destroyTab: vi.fn(() => Promise.resolve()),
    switchTab: vi.fn(),
    hasTab: vi.fn(() => false),
    ...overrides,
  }
}

function createMockHTMLElement(classes: string = '', scrollTop: number = 0): HTMLElement {
  const el = document.createElement('div')
  if (classes) el.className = classes
  el.scrollTop = scrollTop
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ top: 100, left: 0, width: 800, height: 600, right: 800, bottom: 700, x: 0, y: 100 }),
  })
  return el
}

// ── Tests ─────────────────────────────────────────────

describe('ScrollServiceGateway', () => {
  let gateway: ScrollServiceGateway
  let mockProvider: IEditorProvider

  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.innerHTML = ''

    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => clearTimeout(id))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    document.documentElement.innerHTML = ''
  })

  // ── scrollCursorToPosition ─────────────────────────

  describe('scrollCursorToPosition', () => {
    it('should return containerFound: false when no container exists', () => {
      document.body.innerHTML = ''
      document.documentElement.innerHTML = ''

      mockProvider = createMockEditorProvider({ getActiveEditor: () => 'codemirror' })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition()
      expect(result.containerFound).toBe(false)
    })

    it('should return cursorResolved: false when cursor position cannot be determined', () => {
      const editorWysiwyg = createMockHTMLElement('editor-wysiwyg')
      document.body.appendChild(editorWysiwyg)

      mockProvider = createMockEditorProvider({
        getActiveEditor: () => 'crepe',
        getView: () => null,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition()
      expect(result).toEqual({ containerFound: true, cursorResolved: false, scrolledDistance: 0 })
    })

    it('should calculate correct scroll distance for Crepe editor', () => {
      const editorWysiwyg = createMockHTMLElement('editor-wysiwyg', 0)
      document.body.appendChild(editorWysiwyg)

      mockProvider = createMockEditorProvider({
        getActiveEditor: () => 'crepe',
        getView: () => ({
          coordsAtPos: vi.fn(() => ({ top: 400, bottom: 420, left: 100, right: 100 })),
          state: { selection: { from: 10, to: 10 }, tr: {}, doc: {} },
          dispatch: vi.fn(),
        }),
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition()
      expect(result.containerFound).toBe(true)
      expect(result.cursorResolved).toBe(true)
      expect(result.scrolledDistance).toBe(20)
    })

    it('should not scroll when distance is <= 2px', () => {
      const editorWysiwyg = createMockHTMLElement('editor-wysiwyg', 0)
      document.body.appendChild(editorWysiwyg)

      mockProvider = createMockEditorProvider({
        getActiveEditor: () => 'crepe',
        getView: () => ({
          // cursorY = 420 - 100(containerTop) = 320, targetY = 320 → distance = 0
          coordsAtPos: vi.fn(() => ({ top: 420, bottom: 440, left: 100, right: 100 })),
          state: { selection: { from: 10, to: 10 }, tr: {}, doc: {} },
          dispatch: vi.fn(),
        }),
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition()
      expect(result.scrolledDistance).toBeLessThanOrEqual(2)
      expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    })

    it('should use custom targetY when provided', () => {
      const editorWysiwyg = createMockHTMLElement('editor-wysiwyg', 0)
      document.body.appendChild(editorWysiwyg)

      mockProvider = createMockEditorProvider({
        getActiveEditor: () => 'crepe',
        getView: () => ({
          coordsAtPos: vi.fn(() => ({ top: 400, bottom: 420, left: 100, right: 100 })),
          state: { selection: { from: 10, to: 10 }, tr: {}, doc: {} },
          dispatch: vi.fn(),
        }),
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition(200)
      expect(result.scrolledDistance).toBe(100)
    })
  })

  // ── startTypewriterMode / stopTypewriterMode ───────

  describe('startTypewriterMode / stopTypewriterMode', () => {
    it('should subscribe to CURSOR_CHANGED event when started', () => {
      const onSpy = vi.spyOn(eventBus, 'on')
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      gateway.startTypewriterMode()

      expect(onSpy).toHaveBeenCalledWith(AppEvents.CURSOR_CHANGED, expect.any(Function))
    })

    it('should not add duplicate subscription when started twice', () => {
      const onSpy = vi.spyOn(eventBus, 'on')
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      gateway.startTypewriterMode()
      gateway.startTypewriterMode()

      expect(onSpy).toHaveBeenCalledTimes(1)
    })

    it('should unsubscribe from CURSOR_CHANGED event when stopped', () => {
      const unsubscribe = vi.fn()
      vi.spyOn(eventBus, 'on').mockReturnValue(unsubscribe)
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      gateway.startTypewriterMode()
      gateway.stopTypewriterMode()

      expect(unsubscribe).toHaveBeenCalled()
    })

    it('should be idempotent when stopped without starting', () => {
      const unsubscribe = vi.fn()
      vi.spyOn(eventBus, 'on').mockReturnValue(unsubscribe)
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      gateway.stopTypewriterMode()
      expect(unsubscribe).not.toHaveBeenCalled()
    })
  })

  // ── getCursorY ─────────────────────────────────────

  describe('getCursorY', () => {
    it('should return null when no container is found', () => {
      mockProvider = createMockEditorProvider({ getActiveEditor: () => null })
      gateway = new ScrollServiceGateway(mockProvider)

      expect(gateway.getCursorY()).toBeNull()
    })

    it('should return null when cursor position cannot be determined', () => {
      const editorWysiwyg = createMockHTMLElement('editor-wysiwyg')
      document.body.appendChild(editorWysiwyg)

      mockProvider = createMockEditorProvider({
        getActiveEditor: () => 'crepe',
        getView: () => null,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      expect(gateway.getCursorY()).toBeNull()
    })

    it('should return correct cursor position for Crepe editor', () => {
      const editorWysiwyg = createMockHTMLElement('editor-wysiwyg')
      document.body.appendChild(editorWysiwyg)

      mockProvider = createMockEditorProvider({
        getActiveEditor: () => 'crepe',
        getView: () => ({
          coordsAtPos: vi.fn(() => ({ top: 400, bottom: 420, left: 100, right: 100 })),
          state: { selection: { from: 10, to: 10 }, tr: {}, doc: {} },
          dispatch: vi.fn(),
        }),
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.getCursorY()
      expect(result).toEqual({ y: 300, viewportY: 400 })
    })
  })
})