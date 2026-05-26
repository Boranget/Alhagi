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

  let lastTargetType: DropTargetType = 'none'
  let lastTargetTabId: string | null = null
  let lastTargetWindowId: number | null = null
  let lastWindowEdgeDirection: 'left' | 'right' | null = null

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

  function findWindowAtPoint(
    winList: WindowInfo[],
    screenX: number,
    screenY: number
  ): WindowInfo | null {
    let closest: WindowInfo | null = null
    let closestDist = Infinity

    for (const w of winList) {
      const { x, y, width, height } = w.bounds
      
      // 先检查是否精确命中
      if (screenX >= x && screenX <= x + width &&
          screenY >= y && screenY <= y + height) {
        return w
      }

      // 同时计算距离，找到最近的窗口
      const cx = x + width / 2
      const cy = y + height / 2
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

    // 使用 Promise.all 并行获取位置信息
    try {
      const promises = []
      
      if (window.electronAPI.getCursorScreenPoint) {
        promises.push(window.electronAPI.getCursorScreenPoint())
      }
      
      if (window.electronAPI.getScreenDisplay) {
        promises.push(window.electronAPI.getScreenDisplay())
      }

      const results = await Promise.all(promises)
      
      // 第一个结果是 cursorPoint，第二个是 display（如果请求了）
      if (results[0]?.success && results[0]?.data) {
        bounds.x = Math.max(0, results[0].data.x - OFFSET_X)
        bounds.y = Math.max(0, results[0].data.y - OFFSET_Y)

        if (results[1]?.success && results[1]?.data) {
          if (bounds.x + DEFAULT_WIDTH > results[1].data.x + results[1].data.width) {
            bounds.x = results[1].data.x + results[1].data.width - DEFAULT_WIDTH
          }
          if (bounds.y + DEFAULT_HEIGHT > results[1].data.y + results[1].data.height) {
            bounds.y = results[1].data.y + results[1].data.height - DEFAULT_HEIGHT
          }
        }
      }
    } catch (e) {
      console.error('Failed to get cursor position:', e)
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

    lastTargetType = 'none'
    lastTargetTabId = null
    lastTargetWindowId = null
    lastWindowEdgeDirection = null

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

    // 先获取可能的目标状态（不直接更新响应式对象）
    let newTargetType: DropTargetType = 'none'
    let newTargetTabId: string | null = null
    let newTargetWindowId: number | null = null
    let newWindowEdgeDirection: 'left' | 'right' | null = null

    // 先尝试更新窗口边缘状态（支持合并到其他窗口）
    const edgeResult = checkWindowEdge(event)
    if (edgeResult.targetWindowId) {
      newTargetType = 'windowEdge'
      newTargetWindowId = edgeResult.targetWindowId
      newWindowEdgeDirection = edgeResult.direction
    } else if (isMouseOutsideWindow(event)) {
      newTargetType = 'outsideWindow'
    } else {
      newTargetType = 'tab'
      newTargetTabId = tabId
    }

    // 只有在状态真正改变时才更新响应式对象
    const shouldUpdate = 
      newTargetType !== lastTargetType ||
      newTargetTabId !== lastTargetTabId ||
      newTargetWindowId !== lastTargetWindowId ||
      newWindowEdgeDirection !== lastWindowEdgeDirection

    if (shouldUpdate) {
      dragState.targetType = newTargetType
      dragState.targetTabId = newTargetTabId
      dragState.targetWindowId = newTargetWindowId
      dragState.windowEdgeDirection = newWindowEdgeDirection

      lastTargetType = newTargetType
      lastTargetTabId = newTargetTabId
      lastTargetWindowId = newTargetWindowId
      lastWindowEdgeDirection = newWindowEdgeDirection
    }
  }

  function checkWindowEdge(event: DragEvent): { 
    targetWindowId: number | null, 
    direction: 'left' | 'right' | null 
  } {
    const EDGE_THRESHOLD = 50
    const direction: 'left' | 'right' | null =
      event.clientX < EDGE_THRESHOLD ? 'left' :
      event.clientX > window.innerWidth - EDGE_THRESHOLD ? 'right' : null

    const otherWindows = windowList.value.filter(w => w.id !== currentWindowId)
    if (otherWindows.length > 0) {
      const screenX = (window.screenLeft ?? window.screenX ?? 0) + event.clientX
      const screenY = (window.screenTop ?? window.screenY ?? 0) + event.clientY
      const targetWindow = findWindowAtPoint(otherWindows, screenX, screenY)
      
      if (targetWindow) {
        const isNearEdge = 
          event.clientX < EDGE_THRESHOLD ||
          event.clientX > window.innerWidth - EDGE_THRESHOLD ||
          event.clientY < EDGE_THRESHOLD ||
          event.clientY > window.innerHeight - EDGE_THRESHOLD ||
          isMouseOutsideWindow(event)

        if (isNearEdge) {
          const edgeDir = event.clientX < window.innerWidth / 2 ? 'left' : 'right'
          return { targetWindowId: targetWindow.id, direction: edgeDir }
        }
      }
    }
    return { targetWindowId: null, direction: null }
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

  function handleDragEnd(event: DragEvent): void {
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

    // 4. 如果已经在标签上放下，不需要处理
    if (hasDroppedOnTab) {
      resetDragState()
      return
    }

    // 5. 复制状态后立即重置（避免阻塞 UI）
    const currentDragState = {
      sourceTabId: dragState.sourceTabId,
      targetType: dragState.targetType,
      targetTabId: dragState.targetTabId,
      targetWindowId: dragState.targetWindowId,
      windowEdgeDirection: dragState.windowEdgeDirection,
      insertIndex: dragState.insertIndex,
      isNewWindowOperation: dragState.isNewWindowOperation
    }
    
    const currentWindowList = [...windowList.value]
    const currentWindowIdValue = currentWindowId

    // 6. 立即重置响应式状态，让 UI 先恢复
    resetDragState()

    // 7. 获取标签数据（在状态重置前获取）
    const tab = tabsStore.tabs.get(sourceTabId)
    if (!tab) {
      console.warn('[DragDrop] Tab not found:', sourceTabId)
      return
    }

    // 8. 异步执行实际操作，不阻塞用户界面
    executeDragEndAsync(
      event,
      tab,
      currentDragState,
      currentWindowList,
      currentWindowIdValue
    ).catch(error => {
      console.error('[DragDrop] Error during async drag end:', error)
    })
  }

  async function executeDragEndAsync(
    event: DragEvent,
    tab: TabState,
    currentDragState: any,
    currentWindowList: WindowInfo[],
    currentWindowIdValue: number | null
  ): Promise<void> {
    const tabData = serializeTabForIPC(tab)
    const screenX = (window.screenLeft ?? window.screenX ?? 0) + event.clientX
    const screenY = (window.screenTop ?? window.screenY ?? 0) + event.clientY
    const coordsUnreliable = event.clientX === 0 && event.clientY === 0

    const otherWindows = currentWindowList.filter(w => w.id !== currentWindowIdValue)
    let targetWindow: WindowInfo | null = null
    
    if (otherWindows.length > 0) {
      if (currentDragState.targetWindowId) {
        targetWindow = otherWindows.find(w => w.id === currentDragState.targetWindowId) ?? null
      }
      if (!targetWindow) {
        targetWindow = findWindowAtPoint(otherWindows, screenX, screenY)
      }
    }

    const shouldMerge = 
      (currentDragState.targetType === 'windowEdge' && targetWindow) || 
      (currentDragState.targetType !== 'windowEdge' && 
       !coordsUnreliable && 
       targetWindow &&
       (isMouseOutsideWindow(event) || 
        event.clientX < 50 || event.clientX > window.innerWidth - 50))

    if (shouldMerge && targetWindow) {
      const merged = await mergeTabToWindow(tabData, targetWindow.id)
      if (merged) {
        tabsStore.removeTab(currentDragState.sourceTabId)
      }
    } 
    else if (
      currentDragState.targetType === 'outsideWindow' || 
      (!coordsUnreliable && isMouseOutsideWindow(event))
    ) {
      const newWindowId = await createNewWindow(tabData)
      if (newWindowId) {
        tabsStore.removeTab(currentDragState.sourceTabId)
      }
    }
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
