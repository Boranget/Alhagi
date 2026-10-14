import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, createApp, h } from 'vue'
import type { App } from 'vue'

const { mockElectronService } = vi.hoisted(() => ({
  mockElectronService: {
    isAvailable: vi.fn().mockReturnValue(true),
    getWindowId: vi.fn().mockResolvedValue({ success: true, data: 1 }),
    listWindows: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getCursorScreenPoint: vi.fn(),
    getScreenDisplay: vi.fn(),
    openNewWindow: vi.fn(),
    mergeTab: vi.fn(),
  },
}))

vi.mock('@/services/electron/ElectronService', () => ({
  electronService: mockElectronService,
}))

vi.mock('@/composables/useTabActions', () => ({
  useTabActions: () => ({
    createTab: vi.fn(),
    closeTab: vi.fn().mockResolvedValue(undefined),
  }),
}))

import { useTabsStore } from '@/stores/tabs'
import { useTabDragDrop } from '../useTabDragDrop'
import type { TabState, DragDropState } from '@/types'

function createTestTab(id: string): TabState {
  return {
    id,
    filePath: null,
    content: '',
    isDirty: false,
    title: id,
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'markdown',
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
  }
}

interface TabDomElement {
  element: HTMLElement
  tabId: string
}

function createTabElement(tabId: string, left: number, width = 100): TabDomElement {
  const element = document.createElement('div')
  element.className = 'tab-item'
  element.getBoundingClientRect = () => ({
    left,
    width,
    right: left + width,
    top: 0,
    height: 36,
    bottom: 36,
    x: left,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect
  document.body.appendChild(element)
  return { element, tabId }
}

/** 构造 handler 需要的最小 DragEvent 形状；currentTarget 模拟绑定的 .tab-item */
function createDragEvent(
  clientX: number,
  currentTarget?: HTMLElement,
  overrides: Partial<DragEvent> = {}
): DragEvent {
  return {
    clientX,
    clientY: 10,
    preventDefault: vi.fn(),
    dataTransfer: {
      effectAllowed: '',
      setData: vi.fn(),
      setDragImage: vi.fn(),
    },
    currentTarget: currentTarget ?? null,
    ...overrides,
  } as unknown as DragEvent
}

describe('useTabDragDrop - 同窗口标签拖放排序', () => {
  let app: App
  let dnd: ReturnType<typeof useTabDragDrop>
  let store: ReturnType<typeof useTabsStore>
  let tabEls: Record<string, TabDomElement>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockElectronService.isAvailable.mockReturnValue(true)
    mockElectronService.getWindowId.mockResolvedValue({ success: true, data: 1 })
    mockElectronService.listWindows.mockResolvedValue({ success: true, data: [] })

    store = useTabsStore()
    for (const id of ['tab-1', 'tab-2', 'tab-3', 'tab-4']) {
      store.addTab(createTestTab(id))
    }

    tabEls = {}
    for (const id of ['tab-1', 'tab-2', 'tab-3', 'tab-4']) {
      const idx = store.tabOrder.indexOf(id)
      tabEls[id] = createTabElement(id, idx * 100)
    }

    const TestHost = defineComponent({
      setup() {
        dnd = useTabDragDrop()
        return () => h('div')
      },
    })
    app = createApp(TestHost)
    const container = document.createElement('div')
    app.mount(container)
  })

  afterEach(() => {
    app.unmount()
    for (const { element } of Object.values(tabEls)) {
      element.remove()
    }
    vi.useRealTimers()
  })

  function startDrag(sourceId: string): void {
    dnd.handleDragStart(createDragEvent(50, tabEls[sourceId].element), sourceId)
  }

  function dragOver(sourceId: string, targetId: string, clientX: number): void {
    dnd.handleDragOver(createDragEvent(clientX, tabEls[targetId].element), targetId)
  }

  function dropOn(targetId: string, clientX = 50): boolean {
    return dnd.handleDrop(createDragEvent(clientX, tabEls[targetId].element), targetId)
  }

  describe('基本重排', () => {
    it('向右放置：tab-1 拖到 tab-3 右半区 → [tab-2, tab-3, tab-1, tab-4]', () => {
      startDrag('tab-1')
      dragOver('tab-1', 'tab-3', 260)
      expect(dropOn('tab-3', 260)).toBe(true)
      expect(store.tabOrder).toEqual(['tab-2', 'tab-3', 'tab-1', 'tab-4'])
    })

    it('向左放置：tab-4 拖到 tab-2 左半区 → [tab-1, tab-4, tab-2, tab-3]', () => {
      startDrag('tab-4')
      dragOver('tab-4', 'tab-2', 120)
      expect(dropOn('tab-2', 120)).toBe(true)
      expect(store.tabOrder).toEqual(['tab-1', 'tab-4', 'tab-2', 'tab-3'])
    })

    it('中间标签互换：tab-2 拖到 tab-3 右半区 → [tab-1, tab-3, tab-2, tab-4]', () => {
      startDrag('tab-2')
      dragOver('tab-2', 'tab-3', 260)
      expect(dropOn('tab-3', 260)).toBe(true)
      expect(store.tabOrder).toEqual(['tab-1', 'tab-3', 'tab-2', 'tab-4'])
    })

    it('拖到自身返回 false 且顺序不变', () => {
      startDrag('tab-2')
      dnd.handleDragOver(createDragEvent(150, tabEls['tab-2'].element), 'tab-2')
      expect(dropOn('tab-2', 150)).toBe(false)
      expect(store.tabOrder).toEqual(['tab-1', 'tab-2', 'tab-3', 'tab-4'])
    })
  })

  describe('回归：dragleave 防抖后同一目标仍可放置（原 lastTarget* 失步 bug）', () => {
    it('悬停 tab-2 → dragleave 超时 → 再悬停 tab-2 → drop 成功', () => {
      vi.useFakeTimers()

      startDrag('tab-1')
      // tab-2 中点为 150，取 160 = 右半区
      dragOver('tab-1', 'tab-2', 160)
      expect(dnd.dragState.targetType).toBe('tab')
      expect(dnd.dragState.targetTabId).toBe('tab-2')

      // 光标短暂离开标签栏，防抖超时清空目标
      dnd.handleDragLeave(createDragEvent(160))
      vi.advanceTimersByTime(150)
      expect(dnd.dragState.targetType).toBe('none')
      expect(dnd.dragState.targetTabId).toBeNull()

      // 移回同一个 tab：dragover 必须重新写入目标状态（旧 bug：被 lastTarget*
      // 变更检测拦截，targetType 卡在 'none'，drop 被静默拒绝）
      dragOver('tab-1', 'tab-2', 160)
      expect(dnd.dragState.targetType).toBe('tab')
      expect(dnd.dragState.targetTabId).toBe('tab-2')
      expect(dnd.dragState.insertIndex).toBeGreaterThanOrEqual(0)

      expect(dropOn('tab-2', 160)).toBe(true)
      expect(store.tabOrder).toEqual(['tab-2', 'tab-1', 'tab-3', 'tab-4'])
    })

    it('移出后不移回，drop 被拒绝', () => {
      vi.useFakeTimers()

      startDrag('tab-1')
      dragOver('tab-1', 'tab-2', 150)
      dnd.handleDragLeave(createDragEvent(500, undefined, { clientY: 500 } as Partial<DragEvent>))
      vi.advanceTimersByTime(150)

      expect(dropOn('tab-2', 150)).toBe(false)
      expect(store.tabOrder).toEqual(['tab-1', 'tab-2', 'tab-3', 'tab-4'])
    })

    it('dragenter 取消待生效的 leave 防抖', () => {
      vi.useFakeTimers()

      startDrag('tab-1')
      dragOver('tab-1', 'tab-2', 150)
      dnd.handleDragLeave(createDragEvent(150))
      // 防抖未到期前移回
      vi.advanceTimersByTime(50)
      dnd.handleDragEnter(createDragEvent(150, tabEls['tab-2'].element), 'tab-2')
      vi.advanceTimersByTime(100)

      expect(dnd.dragState.targetType).toBe('tab')
      expect(dnd.dragState.targetTabId).toBe('tab-2')
    })
  })

  describe('左右半区判定基于 tab 元素而非子元素（原 event.target bug）', () => {
    it('drop 落在子元素（close 按钮）上仍按 tab 中点判定', () => {
      // tab-3 占 [200, 300)，中点 250。子元素模拟 close 按钮在 [280, 300)
      const childEl = document.createElement('button')
      tabEls['tab-3'].element.appendChild(childEl)

      startDrag('tab-1')
      // dragover 时 currentTarget 是 .tab-item（事件冒泡后绑定元素不变）
      dragOver('tab-1', 'tab-3', 280)
      expect(dnd.dragState.targetType).toBe('tab')

      // drop 事件 target 是子元素，但 currentTarget 仍是 tab-item
      const dropEvent = createDragEvent(280, tabEls['tab-3'].element)
      expect(dnd.handleDrop(dropEvent, 'tab-3')).toBe(true)
      expect(store.tabOrder).toEqual(['tab-2', 'tab-3', 'tab-1', 'tab-4'])
    })

    it('insertIndex 在 dragover 阶段计算，drop 不再依赖事件坐标', () => {
      startDrag('tab-4')
      // tab-1 中点为 50，取 40 = 左半区
      dragOver('tab-4', 'tab-1', 40)

      // drop 时传入错误坐标也不影响——判定来自 dragover 时的 insertIndex
      expect(dropOn('tab-1', 9999)).toBe(true)
      expect(store.tabOrder).toEqual(['tab-4', 'tab-1', 'tab-2', 'tab-3'])
    })
  })

  describe('dragstart 同步阶段配置 dataTransfer', () => {
    it('setData/effectAllowed/setDragImage 在 dragstart 同步执行', () => {
      const dataTransfer = {
        effectAllowed: 'none',
        setData: vi.fn(),
        setDragImage: vi.fn(),
      }
      const event = {
        clientX: 50,
        clientY: 10,
        dataTransfer,
        preventDefault: vi.fn(),
      } as unknown as DragEvent

      dnd.handleDragStart(event, 'tab-1')

      expect(dataTransfer.effectAllowed).toBe('move')
      expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'tab-1')
      expect(dataTransfer.setDragImage).toHaveBeenCalled()
      expect(dnd.dragState.sourceTabId).toBe('tab-1')
    })
  })

  describe('目标类型切换时状态不残留', () => {
    it('从 windowEdge 切回 tab 时清空 windowEdgeDirection', () => {
      mockElectronService.listWindows.mockResolvedValue({
        success: true,
        data: [{
          id: 99,
          title: 'other',
          bounds: { x: 0, y: 0, width: 800, height: 600 },
        }],
      })

      startDrag('tab-1')
      // 模拟窗口边缘命中（clientX < 50 且 findWindowAtPoint 命中）
      dragOver('tab-1', 'tab-2', 30)
      if (dnd.dragState.targetType === 'windowEdge') {
        expect(dnd.dragState.windowEdgeDirection).toBe('left')
      }

      // 移回标签中部：必须切回 tab 且清空边缘状态
      dragOver('tab-1', 'tab-3', 250)
      expect(dnd.dragState.targetType).toBe('tab')
      expect(dnd.dragState.targetTabId).toBe('tab-3')
      expect(dnd.dragState.targetWindowId).toBeNull()
      expect(dnd.dragState.windowEdgeDirection).toBeNull()
    })
  })

  describe('dragend 清理', () => {
    it('drop 成功后 dragend 重置全部状态', () => {
      startDrag('tab-1')
      dragOver('tab-1', 'tab-3', 250)
      dropOn('tab-3', 250)
      dnd.handleDragEnd(createDragEvent(250))

      const state: DragDropState = dnd.dragState
      expect(state.sourceTabId).toBeNull()
      expect(state.targetType).toBe('none')
      expect(state.targetTabId).toBeNull()
      expect(state.insertIndex).toBe(-1)
    })
  })
})
