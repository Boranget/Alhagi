/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, shallowReactive, onMounted, onUnmounted } from 'vue'
import type { DetachedTabData } from '@electron-protocol/index'
import type { 
  TabState, 
  DragDropState, 
  DropTargetType, 
  WindowInfo,
  DraggedTabIdentifier as DraggedTabIdentifierType
} from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { electronService } from '@/services/electron/ElectronService'

/** 拖拽离开防抖延迟：防止光标短暂离开时闪烁 */
const DRAG_LEAVE_DEBOUNCE_MS = 100

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

  const dragState = shallowReactive<DragDropState>({
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
      
      if (screenX >= x && screenX <= x + width &&
          screenY >= y && screenY <= y + height) {
        return w
      }

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
    if (!electronService.isAvailable()) return null

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

    try {
      // 分别 await，避免合并类型让 TS 丢失 width/height 字段信息
      const [cursorResp, displayResp] = await Promise.all([
        electronService.getCursorScreenPoint(),
        electronService.getScreenDisplay(),
      ])

      if (cursorResp.success && cursorResp.data) {
        bounds.x = Math.max(0, cursorResp.data.x - OFFSET_X)
        bounds.y = Math.max(0, cursorResp.data.y - OFFSET_Y)

        if (displayResp.success && displayResp.data) {
          const display = displayResp.data
          if (bounds.x + DEFAULT_WIDTH > display.x + display.width) {
            bounds.x = display.x + display.width - DEFAULT_WIDTH
          }
          if (bounds.y + DEFAULT_HEIGHT > display.y + display.height) {
            bounds.y = display.y + display.height - DEFAULT_HEIGHT
          }
        }
      }
    } catch (e) {
      // Silent fail - bounds calculation errors
    }

    const result = await electronService.openNewWindow({
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
    if (!electronService.isAvailable()) return false

    const result = await electronService.mergeTab(tabData, targetWindowId)
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

    const idResp = await electronService.getWindowId()
    if (idResp.success && idResp.data) {
      currentWindowId = idResp.data
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

    let newTargetType: DropTargetType = 'none'
    let newTargetTabId: string | null = null
    let newTargetWindowId: number | null = null
    let newWindowEdgeDirection: 'left' | 'right' | null = null

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
    const _direction: 'left' | 'right' | null =
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
    }, DRAG_LEAVE_DEBOUNCE_MS)
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
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer)
      dragLeaveTimer = null
    }

    const sourceTabId = dragState.sourceTabId
    
    if (!sourceTabId) {
      resetDragState()
      return
    }

    if (hasDroppedOnTab) {
      resetDragState()
      return
    }

    const currentDragState: DragDropState = {
      sourceTabId: dragState.sourceTabId,
      targetType: dragState.targetType,
      targetTabId: dragState.targetTabId,
      targetWindowId: dragState.targetWindowId,
      windowEdgeDirection: dragState.windowEdgeDirection,
      insertIndex: dragState.insertIndex,
      mousePosition: dragState.mousePosition,
      isNewWindowOperation: dragState.isNewWindowOperation,
    }
    
    const currentWindowList = [...windowList.value]
    const currentWindowIdValue = currentWindowId

    resetDragState()

    const tab = tabsStore.tabs.get(sourceTabId)
    if (!tab) {
      return
    }

    executeDragEndAsync(
      event,
      tab,
      currentDragState,
      currentWindowList,
      currentWindowIdValue
    ).catch(_error => {
      // Silent fail - IPC error
    })
  }

  async function executeDragEndAsync(
    event: DragEvent,
    tab: TabState,
    currentDragState: DragDropState,
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
        tabsStore.removeTab(tab.id)
      }
    }
    else if (
      currentDragState.targetType === 'outsideWindow' ||
      (!coordsUnreliable && isMouseOutsideWindow(event))
    ) {
      const newWindowId = await createNewWindow(tabData)
      if (newWindowId) {
        tabsStore.removeTab(tab.id)
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
      cursor: serializedTab.crepe?.cursor ?? { from: 0, to: 0 }
    }
  }

  async function refreshWindowList(): Promise<void> {
    try {
      const listResp = await electronService.listWindows()
      if (listResp.success && listResp.data) {
        windowList.value = listResp.data
      }
    } catch (e) {
      // Silent fail - window listing errors
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