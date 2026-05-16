import { ref, onMounted, onUnmounted } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'

export function useWritingEnhancement() {
  const prefsStore = usePreferencesStore()
  
  const typewriterMode = ref(false)
  const focusMode = ref(false)
  
  function toggleTypewriterMode() {
    typewriterMode.value = !typewriterMode.value
    prefsStore.typewriterMode = typewriterMode.value
    updateTypewriterMode()
  }
  
  function toggleFocusMode() {
    focusMode.value = !focusMode.value
    prefsStore.focusMode = focusMode.value
    updateFocusMode()
  }
  
  function updateTypewriterMode() {
    if (typewriterMode.value) {
      document.body.classList.add('typewriter-mode')
    } else {
      document.body.classList.remove('typewriter-mode')
    }
  }
  
  function updateFocusMode() {
    if (focusMode.value) {
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
    }
  }
  
  function centerCursorInView() {
    if (!typewriterMode.value) return
    
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
    if (!focusMode.value) return
    
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
    if (typewriterMode.value) {
      centerCursorInView()
    }
  }
  
  function handleSelectionChange() {
    if (focusMode.value) {
      highlightCurrentParagraph()
    }
  }
  
  function initialize() {
    typewriterMode.value = prefsStore.typewriterMode
    focusMode.value = prefsStore.focusMode
    
    if (typewriterMode.value) updateTypewriterMode()
    if (focusMode.value) updateFocusMode()
    
    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('selectionchange', handleSelectionChange)
  }
  
  function cleanup() {
    document.removeEventListener('scroll', handleScroll, true)
    document.removeEventListener('selectionchange', handleSelectionChange)
    
    document.body.classList.remove('typewriter-mode', 'focus-mode')
  }
  
  onMounted(() => {
    initialize()
  })
  
  onUnmounted(() => {
    cleanup()
  })
  
  return {
    typewriterMode,
    focusMode,
    toggleTypewriterMode,
    toggleFocusMode,
    centerCursorInView,
    highlightCurrentParagraph
  }
}
