import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WindowState, SidebarView, Theme } from '@/types'
import { generateUUID } from '@/utils/helpers'

export const useWindowStore = defineStore('window', () => {
  const windowId = ref<string>(generateUUID())
  const windowStates = ref(new Map<string, WindowState>())

  const currentWindowState = computed(() => {
    return windowStates.value.get(windowId.value) || null
  })

  function initWindowState(options: {
    width?: number
    height?: number
    x?: number
    y?: number
    isMaximized?: boolean
  } = {}): WindowState {
    const state: WindowState = {
      windowId: windowId.value,
      width: options.width || 1200,
      height: options.height || 800,
      x: options.x,
      y: options.y,
      isMaximized: options.isMaximized || false,
      sidebarWidth: 240,
      sidebarCollapsed: false,
      activeSidebarView: 'files',
      showStatusBar: true,
      theme: 'light' as Theme,
      editorFontSize: 14,
      editorFontFamily: 'Fira Code',
      wordWrap: true,
      autoSave: true,
      autoSaveInterval: 30000
    }
    
    windowStates.value.set(windowId.value, state)
    return state
  }

  function updateWindowState(updates: Partial<WindowState>): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      Object.assign(state, updates)
    }
  }

  function setSidebarView(view: SidebarView): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      state.activeSidebarView = view
    }
  }

  function toggleSidebar(): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    }
  }

  function setSidebarWidth(width: number): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      state.sidebarWidth = Math.max(180, Math.min(600, width))
    }
  }

  function setTheme(theme: Theme): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      state.theme = theme
      document.documentElement.setAttribute('data-theme', theme)
    }
  }

  function toggleStatusBar(): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      state.showStatusBar = !state.showStatusBar
    }
  }

  function setEditorFontSize(size: number): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      state.editorFontSize = Math.max(10, Math.min(24, size))
    }
  }

  function setWordWrap(enabled: boolean): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      state.wordWrap = enabled
    }
  }

  function setAutoSave(enabled: boolean, interval?: number): void {
    const state = windowStates.value.get(windowId.value)
    if (state) {
      state.autoSave = enabled
      if (interval !== undefined) {
        state.autoSaveInterval = Math.max(5000, Math.min(300000, interval))
      }
    }
  }

  function getWindowState(): WindowState | null {
    return windowStates.value.get(windowId.value) || null
  }

  function saveWindowState(): WindowState | null {
    const state = windowStates.value.get(windowId.value)
    if (!state || !window.electronAPI) return null

    try {
      localStorage.setItem(`window_state_${windowId.value}`, JSON.stringify(state))
      return state
    } catch {
      return null
    }
  }

  function loadWindowState(): WindowState | null {
    if (!window.electronAPI) return null

    try {
      const saved = localStorage.getItem(`window_state_${windowId.value}`)
      if (saved) {
        const state = JSON.parse(saved) as WindowState
        state.windowId = windowId.value
        windowStates.value.set(windowId.value, state)
        return state
      }
    } catch {
      // ignore
    }
    return null
  }

  return {
    windowId,
    windowStates,
    currentWindowState,
    initWindowState,
    updateWindowState,
    setSidebarView,
    toggleSidebar,
    setSidebarWidth,
    setTheme,
    toggleStatusBar,
    setEditorFontSize,
    setWordWrap,
    setAutoSave,
    getWindowState,
    saveWindowState,
    loadWindowState
  }
})
