import { watch } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'

// 模块级状态 —— 确保多实例间共享，避免重复注册事件
let initialized = false
let typewriterActive = false
let focusActive = false
let storeWatchers: (() => void)[] | null = null

// 定时器句柄
let scrollTimer: ReturnType<typeof setTimeout> | null = null

// ──────────────────────────────────────────
// 工具函数
// ──────────────────────────────────────────

/** 找到当前视口内的编辑器滚动容器 */
function findScrollContainer(): HTMLElement | null {
  // 检查光标是否在 CodeMirror 编辑器中（源码模式 或 分屏源码区）
  const activeEl = document.activeElement
  if (activeEl) {
    const cmContainer = activeEl.closest('.codemirror-editor')
    if (cmContainer instanceof HTMLElement) return cmContainer
  }

  // 否则返回 WYSIWYG/分屏预览容器
  return document.querySelector(
    '.editor-wysiwyg, .editor-split-preview'
  ) as HTMLElement | null
}

/** 获取光标在滚动容器内的垂直偏移 */
function getCursorYInContainer(container: HTMLElement): number | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!range.collapsed) return null // 仅处理光标，不处理选区

  // 尝试通过 ProseMirror 原生光标元素获取
  const pmCursor = container.querySelector('.ProseMirror-cursor') as HTMLElement | null
  if (pmCursor) {
    const cursorRect = pmCursor.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    return cursorRect.top - containerRect.top + cursorRect.height / 2
  }

  // 回退：通过 Range 的 ClientRect 获取
  const rects = range.getClientRects()
  if (rects.length > 0) {
    const rect = rects[0]
    const containerRect = container.getBoundingClientRect()
    return rect.top - containerRect.top + rect.height / 2
  }

  // 最后回退：通过 startContainer 计算
  const node = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) {
    const range2 = document.createRange()
    range2.setStart(node, range.startOffset)
    range2.setEnd(node, range.startOffset + 1 > (node.textContent?.length || 0)
      ? range.startOffset
      : range.startOffset + 1)
    const rects2 = range2.getClientRects()
    if (rects2.length > 0) {
      const containerRect = container.getBoundingClientRect()
      return rects2[0].top - containerRect.top + rects2[0].height / 2
    }
  }

  return null
}

// ──────────────────────────────────────────
// 打字机模式
// ──────────────────────────────────────────

function scrollCursorToCenter() {
  if (!typewriterActive) return

  const container = findScrollContainer()
  if (!container) return

  const cursorY = getCursorYInContainer(container)
  if (cursorY === null) return

  const halfHeight = container.clientHeight / 2
  const targetScrollTop = container.scrollTop + cursorY - halfHeight

  // 避免无效微调，减少抖动
  if (Math.abs(container.scrollTop - targetScrollTop) < 5) return

  container.scrollTo({
    top: Math.max(0, targetScrollTop),
    behavior: 'instant' // 用 instant 避免 smooth 动画累积冲突
  })
}

// 防抖版 —— 避免连续输入时频繁滚动
const debouncedScrollCursorToCenter = (() => {
  let rafId: ReturnType<typeof requestAnimationFrame> | null = null
  return () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(scrollCursorToCenter)
  }
})()

// ──────────────────────────────────────────
// 事件处理
// ──────────────────────────────────────────

function handleSelectionChange() {
  if (typewriterActive) {
    debouncedScrollCursorToCenter()
  }
}

function handleEditorScroll(event: Event) {
  const target = event.target as HTMLElement
  // 只处理编辑器容器内的滚动事件
  if (!target.closest('.editor-wysiwyg, .editor-split-preview, .codemirror-editor, .editor-split-source')) {
    return
  }

  // 打字机模式：用户手动滚动时也尝试居中
  if (typewriterActive) {
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(scrollCursorToCenter, 50)
  }
}

// ──────────────────────────────────────────
// 公共 API
// ──────────────────────────────────────────

export function useWritingEnhancement() {
  const prefsStore = usePreferencesStore()

  function toggleTypewriterMode() {
    prefsStore.typewriterMode = !prefsStore.typewriterMode
  }

  function toggleFocusMode() {
    prefsStore.focusMode = !prefsStore.focusMode
  }

  function applyTypewriterMode() {
    typewriterActive = prefsStore.typewriterMode
    if (typewriterActive) {
      document.body.classList.add('typewriter-mode')
      requestAnimationFrame(scrollCursorToCenter)
    } else {
      document.body.classList.remove('typewriter-mode')
    }
  }

  function applyFocusMode() {
    focusActive = prefsStore.focusMode
    if (focusActive) {
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
    }
  }

  function initialize() {
    if (initialized) return
    initialized = true

    // 启动时恢复状态
    applyTypewriterMode()
    applyFocusMode()

    // 监听 store 变化
    storeWatchers = [
      watch(() => prefsStore.typewriterMode, () => {
        applyTypewriterMode()
      }),
      watch(() => prefsStore.focusMode, () => {
        applyFocusMode()
      })
    ]

    // 监听光标位置变化 —— 用于打字机
    document.addEventListener('selectionchange', handleSelectionChange)

    // 监听编辑器区域滚动 —— 打字机模式用户手动滚动后回正
    document.addEventListener('scroll', handleEditorScroll, true)
  }

  function cleanup() {
    initialized = false
    typewriterActive = false
    focusActive = false

    // 清理 store watchers
    if (storeWatchers) {
      storeWatchers.forEach(unwatch => unwatch())
      storeWatchers = null
    }

    document.removeEventListener('selectionchange', handleSelectionChange)
    document.removeEventListener('scroll', handleEditorScroll, true)

    document.body.classList.remove('typewriter-mode', 'focus-mode')

    if (scrollTimer) { clearTimeout(scrollTimer); scrollTimer = null }
  }

  return {
    toggleTypewriterMode,
    toggleFocusMode,
    initialize,
    cleanup,
    scrollCursorToCenter
  }
}
