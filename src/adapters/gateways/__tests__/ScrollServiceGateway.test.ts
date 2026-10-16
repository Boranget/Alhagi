import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ScrollServiceGateway } from '../ScrollServiceGateway'
import { eventBus, AppEvents } from '@/events/eventBus'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { ViewMode } from '@shared/types'

// ── Mock Helpers ──────────────────────────────────────

function createMockEditorProvider(overrides: Partial<IEditorProvider> = {}): IEditorProvider {
  return {
    getActiveEditor: vi.fn(() => 'crepe') as IEditorProvider['getActiveEditor'],
    getScrollContainer: vi.fn(() => null) as IEditorProvider['getScrollContainer'],
    getCursorViewportY: vi.fn(() => null) as IEditorProvider['getCursorViewportY'],
    setEditorFocusMode: vi.fn() as IEditorProvider['setEditorFocusMode'],
    getCommands: vi.fn(() => ({})) as unknown as IEditorProvider['getCommands'],
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
    getCMSearchService: vi.fn(() => null),
    undo: vi.fn(),
    redo: vi.fn(),
    focus: vi.fn(),
    selectAll: vi.fn(),
    insertText: vi.fn(),
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
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition()
      expect(result.containerFound).toBe(false)
    })

    it('should return cursorResolved: false when cursor position cannot be determined', () => {
      const container = createMockHTMLElement()

      mockProvider = createMockEditorProvider({
        getScrollContainer: () => container,
        getCursorViewportY: () => null,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition()
      expect(result).toEqual({ containerFound: true, cursorResolved: false, scrolledDistance: 0 })
    })

    it('should calculate correct scroll distance for cursor at viewport y=400', () => {
      const container = createMockHTMLElement()

      mockProvider = createMockEditorProvider({
        getScrollContainer: () => container,
        getCursorViewportY: () => 400,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition()
      expect(result.containerFound).toBe(true)
      expect(result.cursorResolved).toBe(true)
      expect(result.scrolledDistance).toBe(20)
    })

    it('should not scroll when distance is <= 2px', () => {
      const container = createMockHTMLElement()

      mockProvider = createMockEditorProvider({
        getScrollContainer: () => container,
        // cursorY = 420 - 100(containerTop) = 320, targetY = 320 → distance = 0
        getCursorViewportY: () => 420,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition()
      expect(result.scrolledDistance).toBeLessThanOrEqual(2)
      expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    })

    it('should use custom targetY when provided', () => {
      const container = createMockHTMLElement()

      mockProvider = createMockEditorProvider({
        getScrollContainer: () => container,
        getCursorViewportY: () => 400,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.scrollCursorToPosition(200)
      expect(result.scrolledDistance).toBe(100)
    })
  })

  // ── startTypewriterMode / stopTypewriterMode ───────

  describe('startTypewriterMode / stopTypewriterMode', () => {
    it('should subscribe to CURSOR_CHANGED and TAB_SWITCHED when started', () => {
      const onSpy = vi.spyOn(eventBus, 'on')
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      gateway.startTypewriterMode()

      expect(onSpy).toHaveBeenCalledWith(AppEvents.CURSOR_CHANGED, expect.any(Function))
      expect(onSpy).toHaveBeenCalledWith(AppEvents.TAB_SWITCHED, expect.any(Function))
    })

    it('should not add duplicate subscription when started twice', () => {
      const onSpy = vi.spyOn(eventBus, 'on')
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      gateway.startTypewriterMode()
      gateway.startTypewriterMode()

      // 每个事件各订阅一次（CURSOR_CHANGED + TAB_SWITCHED），重复 start 不叠加
      expect(onSpy).toHaveBeenCalledTimes(2)
    })

    it('should unsubscribe from both events when stopped', () => {
      const unsubscribe = vi.fn()
      vi.spyOn(eventBus, 'on').mockReturnValue(unsubscribe)
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      gateway.startTypewriterMode()
      gateway.stopTypewriterMode()

      expect(unsubscribe).toHaveBeenCalledTimes(2)
    })

    it('should realign cursor to center on TAB_SWITCHED while active', () => {
      const container = createMockHTMLElement()
      // viewport y = 500 → cursorY = 500 - 100(containerTop) = 400 → 目标 320 → 滚 80
      mockProvider = createMockEditorProvider({
        getScrollContainer: () => container,
        getCursorViewportY: () => 500,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      gateway.startTypewriterMode()
      eventBus.emit(AppEvents.TAB_SWITCHED, { tabId: 'tab-2' })
      // 帧 1：外层 rAF 派发 scrollCursorToPosition；帧 2：animatedScrollTo 首帧落 scrollTop
      vi.advanceTimersByTime(32)

      expect(container.scrollTop).toBeGreaterThan(0)

      // 停用后同一事件不再触发滚动
      container.scrollTop = 0
      gateway.stopTypewriterMode()
      eventBus.emit(AppEvents.TAB_SWITCHED, { tabId: 'tab-3' })
      vi.advanceTimersByTime(32)
      expect(container.scrollTop).toBe(0)
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

  // ── 滚动容器来自编辑器端口（DOM 结构映射由池持有） ──

  describe('scroll container from editor provider', () => {
    it('should return the container provided by the editor provider', () => {
      const container = createMockHTMLElement()

      mockProvider = createMockEditorProvider({
        getScrollContainer: () => container,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      expect(gateway.findScrollContainer()).toBe(container)
    })
  })

  // ── getCursorY ─────────────────────────────────────

  describe('getCursorY', () => {
    it('should return null when no container is found', () => {
      mockProvider = createMockEditorProvider()
      gateway = new ScrollServiceGateway(mockProvider)

      expect(gateway.getCursorY()).toBeNull()
    })

    it('should return null when cursor position cannot be determined', () => {
      const container = createMockHTMLElement()

      mockProvider = createMockEditorProvider({
        getScrollContainer: () => container,
        getCursorViewportY: () => null,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      expect(gateway.getCursorY()).toBeNull()
    })

    it('should return correct cursor position given viewport y from port', () => {
      const container = createMockHTMLElement()

      mockProvider = createMockEditorProvider({
        getScrollContainer: () => container,
        getCursorViewportY: () => 400,
      })
      gateway = new ScrollServiceGateway(mockProvider)

      const result = gateway.getCursorY()
      expect(result).toEqual({ y: 300, viewportY: 400 })
    })
  })
})
