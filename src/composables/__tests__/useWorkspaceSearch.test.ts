import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useWorkspaceSearch } from '../useWorkspaceSearch'
import { useSearchStore } from '../../stores/search'
import { useTabsStore } from '../../stores/tabs'
import type { SearchService } from '@/services/search/types'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { TabState } from '@/types'

const holder = vi.hoisted(() => ({
  svc: { value: null as unknown },
}))

vi.mock('../useSearch', () => ({ useSearch: () => holder.svc }))
vi.mock('../useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

type Facade = ReturnType<typeof useWorkspaceSearch>

function makeService(): SearchService & Record<string, ReturnType<typeof vi.fn>> {
  return {
    search: vi.fn(() => ({ current: 2, total: 5 })),
    findNext: vi.fn(() => ({ current: 3, total: 5 })),
    findPrev: vi.fn(() => ({ current: 1, total: 5 })),
    replaceNext: vi.fn(() => ({ current: 0, total: 4 })),
    replaceAll: vi.fn(() => ({ replaced: 2 })),
    clear: vi.fn(),
    isReplacing: vi.fn(() => false),
  } as unknown as SearchService & Record<string, ReturnType<typeof vi.fn>>
}

function createFakeBus(): { bus: IEventBus; onCalls: Array<(...args: unknown[]) => unknown> } {
  const onCalls: Array<(...args: unknown[]) => unknown> = []
  const bus = {
    on: vi.fn((_event: string, cb: (...args: unknown[]) => unknown) => {
      onCalls.push(cb)
      return () => {}
    }),
    off: vi.fn(),
    emit: vi.fn(),
    once: vi.fn(() => () => {}),
    subscribe: vi.fn(() => () => {}),
    clear: vi.fn(),
    hasListeners: vi.fn(() => false),
    getListenerCount: vi.fn(() => 0),
  } as unknown as IEventBus
  return { bus, onCalls }
}

function makeTab(overrides: Partial<TabState>): TabState {
  return {
    id: 'a',
    filePath: '/docs/a.md',
    content: 'hello world',
    isDirty: false,
    title: 'a.md',
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'markdown',
    createdAt: 0,
    lastModified: 0,
    lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    ...overrides,
  }
}

function mountSearch(): { api: Facade; onCalls: Array<(...args: unknown[]) => unknown> } {
  const { bus, onCalls } = createFakeBus()
  const Harness = defineComponent({
    setup() {
      const api = useWorkspaceSearch(bus)
      return { api }
    },
    render: () => null,
  })
  const wrapper = mount(Harness)
  return { api: (wrapper.vm as unknown as { api: Facade }).api, onCalls }
}

describe('useWorkspaceSearch 计数分流（file→共享 store / 工作区→本地）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    holder.svc.value = null
  })

  it('file 范围且无注入引擎：performSearch 绝不清共享计数（侧栏空跑防互踩）', () => {
    useTabsStore().addTab(makeTab({ id: 'a', content: 'hello hello' }))
    const store = useSearchStore()
    store.totalMatches = 7
    store.currentIndex = 3

    const { api } = mountSearch()
    api.searchQuery.value = 'hello'
    api.performSearch()

    expect(store.totalMatches).toBe(7)
    expect(store.currentIndex).toBe(3)
    expect(api.totalMatches.value).toBe(7)
  })

  it('file 范围有引擎：搜索结果写入共享 store 并经门面暴露', () => {
    const svc = makeService()
    holder.svc.value = svc

    const { api } = mountSearch()
    api.searchQuery.value = 'hello'
    api.updateEditorHighlight()

    expect(svc.search).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'hello' }),
      { select: true },
    )
    expect(useSearchStore().totalMatches).toBe(5)
    expect(useSearchStore().currentIndex).toBe(2)
    expect(api.totalMatches.value).toBe(5)
    expect(api.currentMatchIndex.value).toBe(2)
  })

  it('空查询经引擎：clear 并把共享计数归零', () => {
    const svc = makeService()
    holder.svc.value = svc
    const store = useSearchStore()
    store.totalMatches = 5
    store.currentIndex = 2

    const { api } = mountSearch()
    api.updateEditorHighlight()

    expect(svc.clear).toHaveBeenCalled()
    expect(store.totalMatches).toBe(0)
    expect(store.currentIndex).toBe(0)
  })

  it('工作区范围（all）计数走门面本地，不触碰共享 store', () => {
    useTabsStore().addTab(makeTab({ id: 'a', content: 'foo' }))
    useTabsStore().addTab(makeTab({ id: 'b', content: 'foo foo', title: 'b.md' }))
    const store = useSearchStore()
    store.totalMatches = 7
    store.currentIndex = 3

    const { api } = mountSearch()
    api.searchScope.value = 'all'
    api.searchQuery.value = 'foo'
    api.performSearch()

    expect(api.totalMatches.value).toBe(3)
    expect(store.totalMatches).toBe(7)
    expect(store.currentIndex).toBe(3)

    api.navigateNext()
    expect(api.currentMatchIndex.value).toBe(1)
    expect(store.currentIndex).toBe(3)
  })

  it('file 范围导航：引擎返回值写入共享 store', () => {
    const svc = makeService()
    holder.svc.value = svc

    const { api } = mountSearch()
    api.navigateNext()
    expect(svc.findNext).toHaveBeenCalled()
    expect(useSearchStore().currentIndex).toBe(3)
    expect(useSearchStore().totalMatches).toBe(5)

    api.navigatePrev()
    expect(svc.findPrev).toHaveBeenCalled()
    expect(useSearchStore().currentIndex).toBe(1)
  })

  it('hide()：清引擎并把共享计数归零，同时复位本地状态', () => {
    const svc = makeService()
    holder.svc.value = svc
    const store = useSearchStore()

    const { api } = mountSearch()
    api.searchQuery.value = 'hello'
    api.updateEditorHighlight()
    expect(store.totalMatches).toBe(5)

    api.hide()

    expect(svc.clear).toHaveBeenCalled()
    expect(store.totalMatches).toBe(0)
    expect(store.currentIndex).toBe(0)
    expect(api.searchQuery.value).toBe('')
    expect(api.isVisible.value).toBe(false)
  })

  it('切 tab：file 范围带 select=false 重查，共享计数跟上新编辑器', async () => {
    const svc = makeService()
    holder.svc.value = svc
    const tabs = useTabsStore()
    tabs.addTab(makeTab({ id: 'a' }))
    tabs.addTab(makeTab({ id: 'b', title: 'b.md' }))

    const { api } = mountSearch()
    api.searchQuery.value = 'hello'
    ;(svc.search as ReturnType<typeof vi.fn>).mockClear()

    tabs.setActiveTabId('b')
    await nextTick()

    expect(svc.search).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'hello' }),
      { select: false },
    )
    expect(useSearchStore().totalMatches).toBe(5)
  })

  it('CONTENT_CHANGED：file 范围经引擎刷新共享计数；无引擎时共享态不动', async () => {
    const svc = makeService()
    holder.svc.value = svc
    const store = useSearchStore()

    const { api, onCalls } = mountSearch()
    api.searchQuery.value = 'hello'
    expect(onCalls).toHaveLength(1)

    onCalls[0]()
    expect(svc.search).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'hello' }),
      { select: false },
    )
    expect(store.totalMatches).toBe(5)

    // 换成无引擎的实例（侧栏常态）再触发同一事件：共享态必须原样
    holder.svc.value = null
    store.totalMatches = 11
    store.currentIndex = 4
    onCalls[0]()
    expect(store.totalMatches).toBe(11)
    expect(store.currentIndex).toBe(4)
    expect(api.totalMatches.value).toBe(11)
  })
})
