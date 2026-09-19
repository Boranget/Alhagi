// ============================================================
// ScrollServiceGateway — 滚动服务适配器（Adapters Layer）
// ============================================================
//
// 实现 IScrollService 接口，封装编辑器滚动操作的 DOM 细节。
// 依赖 IEditorService 获取编辑器状态，不直接操作编辑器实例。
//
// 职责：
//   - 查找滚动容器（CodeMirror / ProseMirror）
//   - 计算光标 Y 坐标
//   - 执行带缓动的动画滚动
//   - 管理打字机模式的事件监听生命周期

import type { IScrollService, ScrollResult } from '@core/domain/ports/services/IScrollService'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import { eventBus, AppEvents } from '@/events/eventBus'

/** 打字机模式默认目标 Y 坐标（距滚动容器顶部，px） */
const TYPEWRITER_TARGET_Y = 320

export class ScrollServiceGateway implements IScrollService {
  private animationFrameId: number | null = null
  private typewriterListenerActive = false
  private unsubscribeCursorChange: (() => void) | null = null

  constructor(
    private editorProvider: IEditorProvider
  ) {}

  // ── Public API ──────────────────────────────────────

  scrollCursorToPosition(targetY: number = TYPEWRITER_TARGET_Y, duration: number = 100): ScrollResult {
    const container = this.findScrollContainer()
    if (!container) {
      return { containerFound: false, cursorResolved: false, scrolledDistance: 0 }
    }

    const cursorY = this.getCursorYFromContainer(container)
    if (cursorY === null) {
      return { containerFound: true, cursorResolved: false, scrolledDistance: 0 }
    }

    const targetScrollTop = container.scrollTop + cursorY - targetY
    const distance = Math.abs(container.scrollTop - targetScrollTop)

    if (distance > 2) {
      this.animatedScrollTo(container, targetScrollTop, duration)
    }

    return { containerFound: true, cursorResolved: true, scrolledDistance: distance }
  }

  getCursorY(): { y: number; viewportY: number } | null {
    const container = this.findScrollContainer()
    if (!container) return null

    const y = this.getCursorYFromContainer(container)
    if (y === null) return null

    const containerRect = container.getBoundingClientRect()
    return {
      y,
      viewportY: y + containerRect.top,
    }
  }

  findScrollContainer(): HTMLElement | null {
    const activeEditor = this.editorProvider.getActiveEditor()

    if (activeEditor === 'codemirror') {
      return this.findCodeMirrorScroller()
    }

    if (activeEditor === 'crepe') {
      return this.findCrepeContainer()
    }

    return this.findByActiveElement()
  }

  startTypewriterMode(): void {
    if (this.typewriterListenerActive) return

    this.typewriterListenerActive = true
    this.unsubscribeCursorChange = eventBus.on(AppEvents.CURSOR_CHANGED, () => {
      this.throttledScrollToCenter()
    })
  }

  stopTypewriterMode(): void {
    if (!this.typewriterListenerActive) return

    if (this.unsubscribeCursorChange) {
      this.unsubscribeCursorChange()
      this.unsubscribeCursorChange = null
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.typewriterListenerActive = false
  }

  // ── Private: Scroll Container Detection ─────────────

  private findCodeMirrorScroller(): HTMLElement | null {
    return (
      document.querySelector('.cm-editor.cm-focused .cm-scroller') ||
      document.querySelector('.cm-focused .cm-scroller') ||
      document.querySelector('.cm-editor.cm-focused') ||
      document.querySelector('.cm-scroller')
    )
  }

  private findCrepeContainer(): HTMLElement | null {
    return (
      document.querySelector('.editor-wysiwyg') ||
      document.querySelector('.editor-split-preview')
    )
  }

  private findByActiveElement(): HTMLElement | null {
    const activeElement = document.activeElement

    if (activeElement?.closest('.cm-editor')) {
      const cmEditor = activeElement.closest('.cm-editor')
      return (
        (cmEditor as HTMLElement)?.querySelector('.cm-scroller') ||
        (cmEditor as HTMLElement) ||
        document.querySelector('.cm-scroller')
      )
    }

    if (activeElement?.closest('.editor-wysiwyg, .editor-split-preview')) {
      return (
        document.querySelector('.editor-split-preview') ||
        document.querySelector('.editor-wysiwyg')
      )
    }

    if (activeElement?.closest('.editor-split-source, .codemirror-editor')) {
      const cmContainer = activeElement.closest('.codemirror-editor, .editor-split-source')
      return (
        (cmContainer as HTMLElement)?.querySelector('.cm-scroller, .cm-editor') ||
        document.querySelector('.cm-scroller')
      )
    }

    // 回退到通用选择器
    return (
      document.querySelector('.cm-editor.cm-focused .cm-scroller') ||
      document.querySelector('.editor-split-preview') ||
      document.querySelector('.cm-scroller') ||
      document.querySelector('.editor-wysiwyg')
    )
  }

  // ── Private: Cursor Position Calculation ────────────

  private getCursorYFromContainer(container: HTMLElement): number | null {
    const isCodeMirror = container.closest('.cm-editor, .codemirror-editor, .editor-split-source') !== null
    const isCrepe = container.closest('.editor-wysiwyg, .editor-split-preview, .crepe') !== null

    if (isCodeMirror) {
      return this.getCursorYFromCodeMirror(container)
    }

    if (isCrepe) {
      return this.getCursorYFromCrepe(container)
    }

    return this.getCursorYFromSelection(container)
  }

  private getCursorYFromCodeMirror(container: HTMLElement): number | null {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return null

    const rects = selection.getRangeAt(0).getClientRects()
    if (!rects.length) return null

    return rects[0].top - container.getBoundingClientRect().top
  }

  private getCursorYFromCrepe(container: HTMLElement): number | null {
    const view = this.editorProvider.getView()
    if (!view?.coordsAtPos || !view?.state?.selection) return null

    const coords = view.coordsAtPos(view.state.selection.from)
    if (!coords) return null

    return coords.top - container.getBoundingClientRect().top
  }

  private getCursorYFromSelection(container: HTMLElement): number | null {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return null

    const rects = selection.getRangeAt(0).getClientRects()
    if (!rects.length) return null

    return rects[0].top - container.getBoundingClientRect().top
  }

  // ── Private: Animation ──────────────────────────────

  private animatedScrollTo(element: HTMLElement, to: number, duration: number): void {
    const start = element.scrollTop
    const difference = to - start
    const startTime = performance.now()

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }

    const animateScroll = (currentTime: number) => {
      const timeElapsed = currentTime - startTime
      const progress = Math.min(timeElapsed / duration, 1)
      // Cubic ease-out for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      element.scrollTop = start + difference * easeProgress

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animateScroll)
      } else {
        this.animationFrameId = null
      }
    }

    this.animationFrameId = requestAnimationFrame(animateScroll)
  }

  /** 每帧最多执行一次滚动，避免动画冲突 */
  private throttledScrollToCenter(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
    this.animationFrameId = requestAnimationFrame(() => {
      this.scrollCursorToPosition(TYPEWRITER_TARGET_Y, 100)
    })
  }
}
