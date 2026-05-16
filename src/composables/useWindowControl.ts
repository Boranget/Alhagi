import { ref, onMounted, onUnmounted } from 'vue'

export function useWindowControl() {
  const isFullscreen = ref(false)
  const isAlwaysOnTop = ref(false)
  const isMaximized = ref(false)
  const windowBounds = ref({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })
  
  async function minimize() {
    if (window.electronAPI) {
      await window.electronAPI.minimize()
    } else {
      console.warn('Electron API not available')
    }
  }
  
  async function maximize() {
    if (window.electronAPI) {
      await window.electronAPI.maximize()
      isMaximized.value = !isMaximized.value
    } else {
      // 浏览器环境下使用全屏API
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        isFullscreen.value = true
      }
    }
  }
  
  async function close() {
    if (window.electronAPI) {
      await window.electronAPI.close()
    } else {
      window.close()
    }
  }
  
  async function setAlwaysOnTop(flag: boolean) {
    if (window.electronAPI) {
      await window.electronAPI.setAlwaysOnTop(flag)
      isAlwaysOnTop.value = flag
    }
  }
  
  function toggleAlwaysOnTop() {
    setAlwaysOnTop(!isAlwaysOnTop.value)
  }
  
  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      isFullscreen.value = false
    } else {
      await document.documentElement.requestFullscreen()
      isFullscreen.value = true
    }
  }
  
  function handleFullscreenChange() {
    isFullscreen.value = !!document.fullscreenElement
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'F11') {
      e.preventDefault()
      toggleFullscreen()
    }
    
    // Ctrl+Shift+P 切换置顶
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      toggleAlwaysOnTop()
    }
  }
  
  onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('keydown', handleKeydown)
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      windowBounds.value = {
        x: window.screenX,
        y: window.screenY,
        width: window.innerWidth,
        height: window.innerHeight
      }
    })
  })
  
  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('keydown', handleKeydown)
  })
  
  return {
    isFullscreen,
    isAlwaysOnTop,
    isMaximized,
    windowBounds,
    minimize,
    maximize,
    close,
    setAlwaysOnTop,
    toggleAlwaysOnTop,
    toggleFullscreen
  }
}
