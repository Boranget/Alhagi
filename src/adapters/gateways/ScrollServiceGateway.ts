// ============================================================
// ScrollServiceGateway — 滚动服务适配器（Adapters Layer）
// ============================================================
//
// 实现 IScrollService 接口。
// 依赖 IEditorProvider 获取编辑器状态，不直接操作编辑器实例。
//
// 职责：
//   - 从编辑器端口取当前视图模式的滚动容器（DOM 映射由 EditorPool 持有）
//   - 从编辑器端口取光标视口坐标（测量细节由 EditorPool 持有）
//   - 执行带缓动的动画滚动
//   - 管理打字机模式的事件监听生命周期

import type { IScrollService, ScrollResult } from '@core/domain/ports/services/IScrollService'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'

/** 打字机模式默认目标 Y 坐标（距滚动容器顶部，px） */
const TYPEWRITER_TARGET_Y = 320

export class ScrollServiceGateway implements IScrollService {
  private animationFrameId: number | null = null
  private typewriterListenerActive = false
  private unsubscribeCursorChange: (() => void) | null = null
  private unsubscribeTabSwitched: (() => void) | null = null

  constructor(
    private editorProvider: IEditorProvider
  ) {}

  // ── Public API ──────────────────────────────────────

  scrollCursorToPosition(targetY: number = TYPEWRITER_TARGET_Y, duration: number = 100): ScrollResult {
    const container = this.findScrollContainer()
    if (!container) {
      return { containerFound: false, cursorResolved: false, scrolledDistance: 0 }
    }

    const cursorY = this.getCursorYInContainer(container)
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

    const y = this.getCursorYInContainer(container)
    if (y === null) return null

    const containerRect = container.getBoundingClientRect()
    return {
      y,
      viewportY: y + containerRect.top,
    }
  }

  findScrollContainer(): HTMLElement | null {
    return this.editorProvider.getScrollContainer()
  }

  startTypewriterMode(): void {
    if (this.typewriterListenerActive) return

    this.typewriterListenerActive = true
    const bus = useEventBusGateway()
    this.unsubscribeCursorChange = bus.on('editor:cursor:changed', () => {
      this.throttledScrollToCenter()
    })
    // 切 tab 后光标已恢复到各自编辑器（markdown 多实例保活 DOM，
    // viewer 组件在 prop watch 里同步 restore），下一帧即可测量对齐。
    // 否则打字机开启下切 tab，光标停留在上次滚动位置而非居中。
    this.unsubscribeTabSwitched = bus.on('app:tab:switched', () => {
      this.throttledScrollToCenter()
    })
  }

  stopTypewriterMode(): void {
    if (!this.typewriterListenerActive) return

    if (this.unsubscribeCursorChange) {
      this.unsubscribeCursorChange()
      this.unsubscribeCursorChange = null
    }
    if (this.unsubscribeTabSwitched) {
      this.unsubscribeTabSwitched()
      this.unsubscribeTabSwitched = null
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.typewriterListenerActive = false
  }

  // ── Private: Cursor Position Calculation ────────────

  /** 容器坐标系中的光标 Y：端口给视口坐标，容器偏移由网关扣除 */
  private getCursorYInContainer(container: HTMLElement): number | null {
    const viewportY = this.editorProvider.getCursorViewportY()
    if (viewportY === null) return null

    return viewportY - container.getBoundingClientRect().top
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
