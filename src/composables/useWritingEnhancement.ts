import { usePreferencesStore } from '@/stores/preferences'

export function useWritingEnhancement() {
  const prefsStore = usePreferencesStore()

  function toggleTypewriterMode() {
    prefsStore.typewriterMode = !prefsStore.typewriterMode
    updateTypewriterMode()
  }

  function toggleFocusMode() {
    prefsStore.focusMode = !prefsStore.focusMode
    updateFocusMode()
  }

  function updateTypewriterMode() {
    if (prefsStore.typewriterMode) {
      document.body.classList.add('typewriter-mode')
    } else {
      document.body.classList.remove('typewriter-mode')
    }
  }

  function updateFocusMode() {
    if (prefsStore.focusMode) {
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
    }
  }

  function centerCursorInView() {
    if (!prefsStore.typewriterMode) return

    const editor = document.querySelector('.milkdown, .ProseMirror, .editor-content') as HTMLElement
    if (!editor) return

    const cursor = editor.querySelector('.ProseMirror-cursor, .selection, *:focus') as HTMLElement
    if (!cursor) return

    const cursorRect = cursor.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()

    const targetScrollTop = editor.scrollTop + cursorRect.top - editorRect.height / 2

    editor.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    })
  }

  function highlightCurrentParagraph() {
    if (!prefsStore.focusMode) return

    const editor = document.querySelector('.milkdown, .ProseMirror') as HTMLElement
    if (!editor) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    let node = range.startContainer

    while (node && node.parentElement !== editor) {
      node = node.parentElement as Node
    }

    const paragraph = node as HTMLElement
    if (!paragraph || paragraph === editor) return

    editor.querySelectorAll('.focus-highlight').forEach(el => {
      el.classList.remove('focus-highlight')
    })

    if (paragraph && paragraph.style) {
      paragraph.classList.add('focus-highlight')
    }
  }

  function handleScroll() {
    if (prefsStore.typewriterMode) {
      centerCursorInView()
    }
  }

  function handleSelectionChange() {
    if (prefsStore.focusMode) {
      highlightCurrentParagraph()
    }
  }

  function initialize() {
    if (prefsStore.typewriterMode) updateTypewriterMode()
    if (prefsStore.focusMode) updateFocusMode()

    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('selectionchange', handleSelectionChange)
  }

  function cleanup() {
    document.removeEventListener('scroll', handleScroll, true)
    document.removeEventListener('selectionchange', handleSelectionChange)

    document.body.classList.remove('typewriter-mode', 'focus-mode')
  }

  return {
    toggleTypewriterMode,
    toggleFocusMode,
    centerCursorInView,
    highlightCurrentParagraph,
    updateTypewriterMode,
    updateFocusMode,
    initialize,
    cleanup
  }
}
