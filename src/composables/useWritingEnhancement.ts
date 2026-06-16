import { watch } from 'vue'
import { useViewModeStore } from '@/stores/viewMode'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'

// 模块级状态 —— 确保多实例间共享，避免重复注册事件
let initialized = false
let typewriterActive = false
let focusActive = false
let storeWatchers: (() => void)[] | null = null

// 打字机模式：目标 Y 坐标位置（参考 MarkText 的 STANDAR_Y）
const TYPEWRITER_TARGET_Y = 320

// 防抖的动画滚动函数
function animatedScrollTo(element: HTMLElement, to: number, duration: number = 100) {
  const start = element.scrollTop
  const difference = to - start
  const startTime = performance.now()

  const animateScroll = (currentTime: number) => {
    const timeElapsed = currentTime - startTime
    const progress = Math.min(timeElapsed / duration, 1)
    // 使用缓动函数让动画更平滑
    const easeProgress = 1 - Math.pow(1 - progress, 3)
    element.scrollTop = start + difference * easeProgress
    if (progress < 1) {
      requestAnimationFrame(animateScroll)
    }
  }
  requestAnimationFrame(animateScroll)
}

/**
 * 根据滚动容器类型选择合适的坐标获取方式并滚动
 */
function scrollCursorToCenter() {
  if (!typewriterActive) return

  const editorManager = useCrepeEditorManager()
  const activeEditor = editorManager.getActiveEditor()

  try {
    // 根据编辑器类型选择正确的滚动容器
    let scrollContainer: HTMLElement | null = null
    
    if (activeEditor === 'codemirror') {
      // 源码模式：找到当前聚焦的 CodeMirror
      scrollContainer = document.querySelector('.cm-editor.cm-focused .cm-scroller') ||
                       document.querySelector('.cm-focused .cm-scroller') ||
                       document.querySelector('.cm-editor.cm-focused') ||
                       document.querySelector('.cm-scroller')
    } else if (activeEditor === 'crepe') {
      // WYSIWYG 模式：使用 Crepe 的容器
      scrollContainer = document.querySelector('.editor-wysiwyg') ||
                       document.querySelector('.editor-split-preview')
    } else {
      // activeEditor 为 null，根据当前聚焦元素判断
      const activeElement = document.activeElement
      
      if (activeElement?.closest('.cm-editor')) {
        const cmScroller = activeElement.closest('.cm-editor')
        scrollContainer = (cmScroller as HTMLElement)?.querySelector('.cm-scroller') ||
                        (cmScroller as HTMLElement) ||
                        document.querySelector('.cm-scroller')
      } else if (activeElement?.closest('.editor-wysiwyg, .editor-split-preview')) {
        scrollContainer = document.querySelector('.editor-split-preview') ||
                        document.querySelector('.editor-wysiwyg')
      } else if (activeElement?.closest('.editor-split-source, .codemirror-editor')) {
        const cmEditor = activeElement.closest('.codemirror-editor, .editor-split-source')
        scrollContainer = (cmEditor as HTMLElement)?.querySelector('.cm-scroller, .cm-editor') ||
                        document.querySelector('.cm-scroller')
      } else {
        // 回退到通用选择器
        scrollContainer = document.querySelector('.cm-editor.cm-focused .cm-scroller') ||
                        document.querySelector('.editor-split-preview') ||
                        document.querySelector('.cm-scroller') ||
                        document.querySelector('.editor-wysiwyg')
      }
    }
    
    if (!scrollContainer) return

    // 计算光标 Y 坐标
    let cursorY = 0
    const isCodeMirror = scrollContainer.closest('.cm-editor, .codemirror-editor, .editor-split-source') !== null
    const isCrepe = scrollContainer.closest('.editor-wysiwyg, .editor-split-preview, .crepe') !== null

    if (isCodeMirror) {
      // CodeMirror 源码模式：使用 Selection API
      const selection = window.getSelection()
      if (selection?.rangeCount) {
        const rects = selection.getRangeAt(0).getClientRects()
        if (rects.length) {
          cursorY = rects[0].top - scrollContainer.getBoundingClientRect().top
        }
      }
    } else if (isCrepe) {
      // Crepe WYSIWYG 模式：使用 EditorView API
      const view = editorManager.getEditorView()
      if (view) {
        const coords = view.coordsAtPos(view.state.selection.from)
        cursorY = coords.top - scrollContainer.getBoundingClientRect().top
      }
    } else {
      // 未知类型，使用通用方法
      const selection = window.getSelection()
      if (selection?.rangeCount) {
        const rects = selection.getRangeAt(0).getClientRects()
        if (rects.length) {
          cursorY = rects[0].top - scrollContainer.getBoundingClientRect().top
        }
      }
    }

    if (!cursorY) return

    // 滚动到目标位置（留出 TYPEWRITER_TARGET_Y 的顶部空间）
    const targetScrollTop = scrollContainer.scrollTop + cursorY - TYPEWRITER_TARGET_Y
    if (Math.abs(scrollContainer.scrollTop - targetScrollTop) > 2) {
      animatedScrollTo(scrollContainer, targetScrollTop, 100)
    }
  } catch (error) {
    // Silent fail - scroll animation errors
  }
}

// 防抖的滚动函数
let scrollAnimationFrameId: number | null = null
const debouncedScrollCursorToCenter = () => {
  if (scrollAnimationFrameId) cancelAnimationFrame(scrollAnimationFrameId)
  scrollAnimationFrameId = requestAnimationFrame(scrollCursorToCenter)
}

/**
 * 选择变化事件处理
 */
function handleSelectionChange() {
  if (typewriterActive) {
    debouncedScrollCursorToCenter()
  }
}

/**
 * 公共 API - 导出给组件使用
 */
export function useWritingEnhancement() {
  // typewriter / focus 是 per-window 的临时视图模式（不持久化、不跨窗口同步），
  // 由 viewModeStore 持有；Pinia 单例 = 每个渲染进程一份，天然 per-window。
  const viewMode = useViewModeStore()

  function toggleTypewriterMode() {
    viewMode.toggleTypewriterMode()
  }

  function toggleFocusMode() {
    viewMode.toggleFocusMode()
  }

  function applyTypewriterMode() {
    typewriterActive = viewMode.typewriterMode
    if (typewriterActive) {
      document.body.classList.add('typewriter-mode')
      // 立即滚动光标到中心
      requestAnimationFrame(scrollCursorToCenter)
    } else {
      document.body.classList.remove('typewriter-mode')
    }
  }

  function applyFocusMode() {
    focusActive = viewMode.focusMode
    if (focusActive) {
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
    }
  }

  function initialize() {
    if (initialized) return
    initialized = true

    // 启动时恢复状态（这两个 ref 在 viewModeStore 初始默认就是 false，
    // 所以启动等价于"清掉 body class"——applyXxx 会处理）
    applyTypewriterMode()
    applyFocusMode()

    // 监听 store 变化
    storeWatchers = [
      watch(() => viewMode.typewriterMode, () => {
        applyTypewriterMode()
      }),
      watch(() => viewMode.focusMode, () => {
        applyFocusMode()
      })
    ]

    // 只需要监听全局 selectionchange 事件
    // 当打字机模式开启时，每次选择变化都会触发滚动
    document.addEventListener('selectionchange', handleSelectionChange)
  }

  function cleanup() {
    initialized = false
    typewriterActive = false
    focusActive = false

    if (scrollAnimationFrameId) {
      cancelAnimationFrame(scrollAnimationFrameId)
      scrollAnimationFrameId = null
    }

    // 清理 store watchers
    if (storeWatchers) {
      storeWatchers.forEach(unwatch => unwatch())
      storeWatchers = null
    }

    document.removeEventListener('selectionchange', handleSelectionChange)
    document.body.classList.remove('typewriter-mode', 'focus-mode')
  }

  return {
    toggleTypewriterMode,
    toggleFocusMode,
    initialize,
    cleanup,
    scrollCursorToCenter
  }
}
