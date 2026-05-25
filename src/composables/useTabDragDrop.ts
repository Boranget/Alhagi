import { ref, reactive, onMounted, onUnmounted } from 'vue'
import type { DetachedTabData } from '../../electron-protocol/index'
import type { 
  TabState, 
  DragDropState, 
  DropTargetType, 
  WindowInfo,
  DraggedTabIdentifier as DraggedTabIdentifierType
} from '@/types'
import { useTabsStore } from '@/stores/tabs'

export type { DropTargetType }
export type { DragDropState }
export type { WindowInfo }

export class DraggedTabIdentifier implements DraggedTabIdentifierType {
  constructor(
    public readonly tabId: string,
    public readonly windowId: number
  ) {}
}

export function useTabDragDrop() {
  const tabsStore = useTabsStore()

  const dragState = reactive<DragDropState>({
    sourceTabId: null,
    targetType: 'none',
    targetTabId: null,
    targetWindowId: null,
    windowEdgeDirection: null,
    insertIndex: -1,
    mousePosition: { x: 0, y: 0 },
    isNewWindowOperation: false
  })

  const windowList = ref<WindowInfo[]>([])
  let currentWindowId: number | null = null
  let hasDroppedOnTab = false
  let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null

  function isMouseOutsideWindow(event: DragEvent): boolean {
    return (
      event.clientX < 0 ||
      event.clientX > window.innerWidth ||
      event.clientY < 0 ||
      event.clientY > window.innerHeight
    )
  }

  function updateWindowEdgeState(event: DragEvent): void {
    const EDGE_THRESHOLD = 50

    // 无论鼠标是否在窗口内，都要检查是否有其他窗口在附近
    const otherWindows = windowList.value.filter(w => w.id !== currentWindowId)
    
    if (otherWindows.length > 0) {
      // 计算屏幕坐标
      const screenX = (window.screenLeft ?? window.screenX ?? 0) + event.clientX
      const screenY = (window.screenTop ?? window.screenY ?? 0) + event.clientY

      // 找到鼠标位置附近的窗口
      const targetWindow = findWindowAtPoint(otherWindows, screenX, screenY)

      if (targetWindow) {
        // 如果是在窗口边缘或窗口外，且鼠标指向其他窗口
        const isNearEdge = 
          event.clientX < EDGE_THRESHOLD ||
          event.clientX > window.innerWidth - EDGE_THRESHOLD ||
          event.clientY < EDGE_THRESHOLD ||
          event.clientY > window.innerHeight - EDGE_THRESHOLD ||
          isMouseOutsideWindow(event)

        if (isNearEdge) {
          // 确定方向（只是视觉指示，不影响实际功能）
          const direction: 'left' | 'right' =
            event.clientX < window.innerWidth / 2 ? 'left' : 'right'

          dragState.targetType = 'windowEdge'
          dragState.windowEdgeDirection = direction
          dragState.targetWindowId = targetWindow.id
          dragState.targetTabId = null
          return
        }
      }
    }

    // 如果鼠标不在边缘且不在指向其他窗口，且鼠标在窗口内，则不做特殊处理
    // 保持之前的状态，或重置为 none 让它可以成为 tab 目标
    if (!isMouseOutsideWindow(event)) {
      dragState.targetType = 'none'
      dragState.windowEdgeDirection = null
      dragState.targetWindowId = null
      dragState.targetTabId = null
    }
  }

  function findWindowAtPoint(
    winList: WindowInfo[],
    screenX: number,
    screenY: number
  ): WindowInfo | null {
    for (const w of winList) {
      const { x, y, width, height } = w.bounds
      if (screenX >= x && screenX <= x + width &&
          screenY >= y && screenY <= y + height) {
        return w
      }
    }

    let closest: WindowInfo | null = null
    let closestDist = Infinity

    for (const w of winList) {
      const cx = w.bounds.x + w.bounds.width / 2
      const cy = w.bounds.y + w.bounds.height / 2
      const dist = Math.sqrt((screenX - cx) ** 2 + (screenY - cy) ** 2)
      if (dist < closestDist) {
        closestDist = dist
        closest = w
      }
    }

    return closest
  }

  async function createNewWindow(tabData: DetachedTabData): Promise<number | null> {
    if (!window.electronAPI) return null

    const DEFAULT_WIDTH = 1200
    const DEFAULT_HEIGHT = 800
    const OFFSET_X = DEFAULT_WIDTH / 2
    const OFFSET_Y = 30

    const bounds = {
      x: 100,
      y: 100,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT
    }

    if (window.electronAPI.getCursorScreenPoint) {
      try {
        const cursorPoint = await window.electronAPI.getCursorScreenPoint()
        const display = window.electronAPI.getScreenDisplay ? await window.electronAPI.getScreenDisplay() : null

        if (cursorPoint.success && cursorPoint.data) {
          bounds.x = Math.max(0, cursorPoint.data.x - OFFSET_X)
          bounds.y = Math.max(0, cursorPoint.data.y - OFFSET_Y)

          if (display?.success && display.data) {
            if (bounds.x + DEFAULT_WIDTH > display.data.x + display.data.width) {
              bounds.x = display.data.x + display.data.width - DEFAULT_WIDTH
            }
            if (bounds.y + DEFAULT_HEIGHT > display.data.y + display.data.height) {
              bounds.y = display.data.y + display.data.height - DEFAULT_HEIGHT
            }
          }
        }
      } catch (e) {
        console.error('Failed to get cursor position:', e)
      }
    }

    const result = await window.electronAPI.openNewWindow({
      bounds,
      tabData
    })

    if (result.success && result.data) {
      return typeof result.data === 'number' ? result.data : null
    }
    return null
  }

  async function mergeTabToWindow(
    tabData: DetachedTabData,
    targetWindowId: number
  ): Promise<boolean> {
    if (!window.electronAPI) return false

    const result = await window.electronAPI.mergeTab(tabData, targetWindowId)
    return result.success
  }

  function getDropIndicatorPosition(
    event: DragEvent,
    targetElement: HTMLElement
  ): 'left' | 'right' {
    const rect = targetElement.getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2

    return event.clientX > midpoint ? 'right' : 'left'
  }

  async function handleDragStart(event: DragEvent, tabId: string): Promise<void> {
    resetDragState()

    dragState.sourceTabId = tabId
    hasDroppedOnTab = false

    await refreshWindowList()

    if (window.electronAPI) {
      const idResp = await window.electronAPI.getWindowId()
      if (idResp.success && idResp.data) {
        currentWindowId = idResp.data
      }
    }

    const tab = tabsStore.tabs.get(tabId)
    if (tab) {
      applyDragImage(event, tab)
    }
  }

  function handleDragEnter(event: DragEvent, tabId: string): void {
    if (!dragState.sourceTabId || dragState.sourceTabId === tabId) {
      return
    }

    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer)
      dragLeaveTimer = null
    }
  }

  function handleDragOver(event: DragEvent, tabId: string): void {
    if (!dragState.sourceTabId) return

    if (dragState.sourceTabId === tabId) return

    dragState.mousePosition = {
      x: event.clientX,
      y: event.clientY
    }

    // 先尝试更新窗口边缘状态（支持合并到其他窗口）
    updateWindowEdgeState(event)
    
    // 如果不是在窗口边缘，再检查是否是拖到窗口外
    if (dragState.targetType !== 'windowEdge') {
      if (isMouseOutsideWindow(event)) {
        dragState.targetType = 'outsideWindow'
        dragState.targetTabId = null
        dragState.windowEdgeDirection = null
        dragState.targetWindowId = null
        return
      }
      
      dragState.targetTabId = tabId
      dragState.targetType = 'tab'
    }
  }

  function handleDragLeave(_event: DragEvent): void {
    if (!dragState.sourceTabId) return

    if (dragLeaveTimer) clearTimeout(dragLeaveTimer)

    dragLeaveTimer = setTimeout(() => {
      if (dragState.targetType === 'tab') {
        dragState.targetTabId = null
        dragState.targetType = 'none'
      }
    }, 100)
  }

  function handleDrop(event: DragEvent, targetTabId: string): boolean {
    event.preventDefault()

    if (!dragState.sourceTabId || dragState.sourceTabId === targetTabId) {
      return false
    }

    if (dragState.targetType !== 'tab') {
      return false
    }

    hasDroppedOnTab = true

    const currentOrder = [...tabsStore.tabOrder]
    const fromIndex = currentOrder.indexOf(dragState.sourceTabId)
    const toIndex = currentOrder.indexOf(targetTabId)

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return false
    }

    currentOrder.splice(fromIndex, 1)

    const adjustedTargetIdx = fromIndex < toIndex ? toIndex - 1 : toIndex

    const insertDirection = getDropIndicatorPosition(event, event.target as HTMLElement)
    const insertAt = insertDirection === 'right' ?
      adjustedTargetIdx + 1 :
      adjustedTargetIdx

    tabsStore.tabOrder = [
      ...currentOrder.slice(0, insertAt),
      dragState.sourceTabId,
      ...currentOrder.slice(insertAt)
    ]

    return true
  }

  async function handleDragEnd(event: DragEvent): Promise<void> {
    // 1. 首先清理定时器
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer)
      dragLeaveTimer = null
    }

    // 2. 获取源标签信息
    const sourceTabId = dragState.sourceTabId
    
    // 3. 如果没有源标签，立即重置状态并返回
    if (!sourceTabId) {
      resetDragState()
      return
    }

    // 4. 获取标签数据
    const tab = tabsStore.tabs.get(sourceTabId)
    if (!tab) {
      console.warn('[DragDrop] Tab not found:', sourceTabId)
      resetDragState()
      return
    }

    // 5. 如果已经在标签上放下，不需要处理
    if (hasDroppedOnTab) {
      resetDragState()
      return
    }

    // 6. 序列化标签数据
    const tabData = serializeTabForIPC(tab)
    
    // 7. 计算屏幕坐标
    const screenX = (window.screenLeft ?? window.screenX ?? 0) + event.clientX
    const screenY = (window.screenTop ?? window.screenY ?? 0) + event.clientY
    const coordsUnreliable = event.clientX === 0 && event.clientY === 0

    // 8. 获取其他窗口列表
    const otherWindows = windowList.value.filter(w => w.id !== currentWindowId)
    
    // 9. 查找目标窗口
    let targetWindow: WindowInfo | null = null
    
    if (otherWindows.length > 0) {
      // 优先使用 dragState 中已有的目标窗口
      if (dragState.targetWindowId) {
        targetWindow = otherWindows.find(w => w.id === dragState.targetWindowId) ?? null
      }
      
      // 如果没有找到，根据鼠标屏幕位置重新查找
      if (!targetWindow) {
        targetWindow = findWindowAtPoint(otherWindows, screenX, screenY)
      }
    }

    // 10. 根据目标类型执行相应操作
    try {
      const shouldMerge = 
        (dragState.targetType === 'windowEdge' && targetWindow) || 
        (dragState.targetType !== 'windowEdge' && 
         !coordsUnreliable && 
         targetWindow &&
         (isMouseOutsideWindow(event) || 
          event.clientX < 50 || event.clientX > window.innerWidth - 50))

      if (shouldMerge && targetWindow) {
        // 合并到目标窗口
        const merged = await mergeTabToWindow(tabData, targetWindow.id)
        if (merged) {
          tabsStore.removeTab(sourceTabId)
        }
      } 
      else if (
        dragState.targetType === 'outsideWindow' || 
        (!coordsUnreliable && isMouseOutsideWindow(event))
      ) {
        // 创建新窗口
        const newWindowId = await createNewWindow(tabData)
        if (newWindowId) {
          tabsStore.removeTab(sourceTabId)
        }
      }
    } catch (error) {
      console.error('[DragDrop] Error during drag end:', error)
    }

    resetDragState()
  }

  function applyDragImage(event: DragEvent, tab: TabState): void {
    if (!event.dataTransfer) return

    const dragImage = document.createElement('div')
    dragImage.className = 'tab-drag-image'
    dragImage.textContent = tab.title || 'Untitled'
    document.body.appendChild(dragImage)

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setDragImage(dragImage, -10, -10)

    setTimeout(() => dragImage.remove(), 0)
  }

  function serializeTabForIPC(tab: TabState): DetachedTabData {
    const serializedTab = JSON.parse(JSON.stringify(tab))
    return {
      id: serializedTab.id,
      title: serializedTab.title,
      content: serializedTab.content,
      filePath: serializedTab.filePath ?? null,
      isDirty: serializedTab.isDirty,
      viewMode: serializedTab.viewMode,
      cursor: serializedTab.cursor ?? { from: 0, to: 0 }
    }
  }

  async function refreshWindowList(): Promise<void> {
    if (window.electronAPI) {
      try {
        const listResp = await window.electronAPI.listWindows()
        if (listResp.success && listResp.data) {
          windowList.value = listResp.data
        }
      } catch (e) {
        console.error('Failed to get window info:', e)
      }
    }
  }

  function resetDragState(): void {
    dragState.sourceTabId = null
    dragState.targetType = 'none'
    dragState.targetTabId = null
    dragState.targetWindowId = null
    dragState.windowEdgeDirection = null
    dragState.insertIndex = -1
    dragState.isNewWindowOperation = false
    hasDroppedOnTab = false
  }

  onMounted(() => {
    refreshWindowList()
  })

  onUnmounted(() => {
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer)
    }
  })

  return {
    dragState,
    windowList,

    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,

    isMouseOutsideWindow,
    resetDragState,
    refreshWindowList,
    serializeTabForIPC
  }
}
