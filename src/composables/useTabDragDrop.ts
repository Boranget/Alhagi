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
import { beginTabTransfer } from '@/services/crossWindowTab'
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

/** updateTarget 的局部更新描述：未提及的字段一律重置为默认值 */
interface DropTargetUpdate {
  targetType: DropTargetType
  targetTabId?: string | null
  targetWindowId?: number | null
  windowEdgeDirection?: 'left' | 'right' | null
  insertIndex?: number
}

export function useTabDragDrop() {
  const tabsStore = useTabsStore()

  // 唯一状态源：dragState 是拖拽期间所有判定的单一数据源。
  // 不存在需要手动同步的影子变量（lastTarget* 已移除——它们与
  // dragState 失步正是"放下无反应"bug 的根因）。
  const dragState = shallowReactive<DragDropState>({
    sourceTabId: null,
    targetType: 'none',
    targetTabId: null,
    targetWindowId: null,
    windowEdgeDirection: null,
    insertIndex: -1
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

  /**
   * 计算"把 sourceTab 放到 targetTab 某一侧"时，移除 sourceTab 后
   * 的最终插入下标。返回 -1 表示无效（tab 不存在或拖到自身）。
   */
  function computeInsertIndex(targetTabId: string, placeAfter: boolean): number {
    const sourceTabId = dragState.sourceTabId
    if (!sourceTabId) return -1

    const order = tabsStore.tabOrder
    const fromIndex = order.indexOf(sourceTabId)
    const toIndex = order.indexOf(targetTabId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return -1

    const adjustedTargetIdx = fromIndex < toIndex ? toIndex - 1 : toIndex
    return placeAfter ? adjustedTargetIdx + 1 : adjustedTargetIdx
  }

  function handleDragStart(event: DragEvent, tabId: string): void {
    resetDragState()
    dragState.sourceTabId = tabId

    // dataTransfer 配置（setData/effectAllowed/setDragImage）必须在
    // dragstart 的同步阶段完成，await 之后浏览器会忽略这些调用。
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', tabId)
    }
    const tab = tabsStore.tabs.get(tabId)
    if (tab) {
      applyDragImage(event, tab)
    }

    // 窗口列表只服务于跨窗口合并探测，异步刷新即可，不阻塞拖拽启动
    refreshWindowList().catch(() => {
      // Silent fail - 窗口列表获取失败不阻塞拖拽
    })
  }

  function handleDragEnter(_event: DragEvent, _tabId: string): void {
    // 进入任何元素都取消待生效的 leave 防抖，避免误清目标
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer)
      dragLeaveTimer = null
    }
  }

  function handleDragOver(event: DragEvent, tabId: string): void {
    if (!dragState.sourceTabId) return

    const edgeResult = checkWindowEdge(event)
    if (edgeResult.targetWindowId) {
      updateTarget({
        targetType: 'windowEdge',
        targetWindowId: edgeResult.targetWindowId,
        windowEdgeDirection: edgeResult.direction
      })
      return
    }
    if (isMouseOutsideWindow(event)) {
      updateTarget({ targetType: 'outsideWindow' })
      return
    }
    if (tabId === dragState.sourceTabId) {
      updateTarget({ targetType: 'none' })
      return
    }

    // 必须用 currentTarget（绑定 handler 的 .tab-item）。event.target
    // 可能是 .tab-title/.tab-close 子元素，用它的 rect 算中点会判错左右。
    const tabElement = event.currentTarget as HTMLElement
    const rect = tabElement.getBoundingClientRect()
    const placeAfter = event.clientX > rect.left + rect.width / 2
    const insertIndex = computeInsertIndex(tabId, placeAfter)
    if (insertIndex === -1) return

    updateTarget({ targetType: 'tab', targetTabId: tabId, insertIndex })
  }

  /**
   * 拖放目标状态的唯一写入口：未提及的字段一律重置为默认值，
   * 保证各目标类型之间切换时不会残留上一目标的状态。
   * 直接赋值即可——Vue 响应式 set 对相同值是 no-op，无需手动变更检测。
   */
  function updateTarget(partial: DropTargetUpdate): void {
    dragState.targetType = partial.targetType
    dragState.targetTabId = partial.targetTabId ?? null
    dragState.targetWindowId = partial.targetWindowId ?? null
    dragState.windowEdgeDirection = partial.windowEdgeDirection ?? null
    dragState.insertIndex = partial.insertIndex ?? -1
  }

  function checkWindowEdge(event: DragEvent): {
    targetWindowId: number | null,
    direction: 'left' | 'right' | null
  } {
    const EDGE_THRESHOLD = 50
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
      dragLeaveTimer = null
      // 仅清理"标签"类目标；边缘/窗口外目标由后续 dragover/dragend 决定
      if (dragState.targetType === 'tab') {
        updateTarget({ targetType: 'none' })
      }
    }, DRAG_LEAVE_DEBOUNCE_MS)
  }

  function handleDrop(event: DragEvent, targetTabId: string): boolean {
    event.preventDefault()

    if (!dragState.sourceTabId || dragState.sourceTabId === targetTabId) {
      return false
    }

    if (dragState.targetType !== 'tab' || dragState.insertIndex < 0) {
      return false
    }

    hasDroppedOnTab = true

    const currentOrder = [...tabsStore.tabOrder]
    const fromIndex = currentOrder.indexOf(dragState.sourceTabId)
    if (fromIndex === -1) return false

    // insertIndex 是"移除 sourceTab 后"的下标（dragover 时已计算好），
    // 直接应用即可，drop 阶段无需再读 event 坐标。
    currentOrder.splice(fromIndex, 1)
    currentOrder.splice(dragState.insertIndex, 0, dragState.sourceTabId)

    tabsStore.setTabOrder(currentOrder)

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

    // 在 reset 前快照异步流程需要的值，避免 IPC 期间状态被清空
    const endedTargetType = dragState.targetType
    const endedTargetWindowId = dragState.targetWindowId
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
      endedTargetType,
      endedTargetWindowId,
      currentWindowList,
      currentWindowIdValue
    ).catch(_error => {
      // Silent fail - IPC error
    })
  }

  async function executeDragEndAsync(
    event: DragEvent,
    tab: TabState,
    targetType: DropTargetType,
    targetWindowId: number | null,
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
      if (targetWindowId) {
        targetWindow = otherWindows.find(w => w.id === targetWindowId) ?? null
      }
      if (!targetWindow) {
        targetWindow = findWindowAtPoint(otherWindows, screenX, screenY)
      }
    }

    const shouldMerge =
      (targetType === 'windowEdge' && targetWindow) ||
      (targetType !== 'windowEdge' &&
       !coordsUnreliable &&
       targetWindow &&
       (isMouseOutsideWindow(event) ||
        event.clientX < 50 || event.clientX > window.innerWidth - 50))

    if (shouldMerge && targetWindow) {
      const merged = await mergeTabToWindow(tabData, targetWindow.id)
      if (merged) {
        // 走 CloseTab：邻居切换、TAB_CLOSED（释放源窗口 EditorPool 实例）、
        // opened-files 同步；直接 store.removeTabById 会全部缺失。
        // 删除不立即执行：登记待确认，目标窗口回发 ack 后才真正 closeTab
        // （ack 超时则保留源 tab —— 数据安全优先）。
        beginTabTransfer(tab.id)
      }
    }
    else if (
      targetType === 'outsideWindow' ||
      (!coordsUnreliable && isMouseOutsideWindow(event))
    ) {
      const newWindowId = await createNewWindow(tabData)
      if (newWindowId) {
        beginTabTransfer(tab.id)
      }
    }
  }

  function applyDragImage(event: DragEvent, tab: TabState): void {
    if (!event.dataTransfer) return

    const dragImage = document.createElement('div')
    dragImage.className = 'tab-drag-image'
    dragImage.textContent = tab.title || 'Untitled'
    document.body.appendChild(dragImage)

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
      cursor: serializedTab.crepe?.cursor ?? { from: 0, to: 0 },
      // 目标窗口恢复成功后据此回发 ack，源窗口收到才删除本地副本
      sourceWindowId: currentWindowId ?? undefined
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

  async function initWindowId(): Promise<void> {
    try {
      const idResp = await electronService.getWindowId()
      if (idResp.success && typeof idResp.data === 'number') {
        currentWindowId = idResp.data
      }
    } catch (e) {
      // Silent fail - window id 获取失败时按"无本窗口 id"处理
    }
  }

  function resetDragState(): void {
    dragState.sourceTabId = null
    updateTarget({ targetType: 'none' })
    hasDroppedOnTab = false
  }

  onMounted(() => {
    // windowId 在窗口生命周期内不变，挂载时取一次即可，无需每次 dragstart 取
    initWindowId()
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
