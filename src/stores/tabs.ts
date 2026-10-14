import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TabState, ViewMode, FileType } from '@/types'
import type { ITabRepository, CreateTabOptions, TabUpdates } from '@core/domain/ports/repositories/ITabRepository'
import { Tab } from '@core/entities/Tab'
import { eventBus, AppEvents } from '@/events/eventBus'

function toTab(state: TabState): Tab {
  return new Tab({
    id: state.id,
    filePath: state.filePath,
    content: state.content,
    isDirty: state.isDirty,
    title: state.title,
    viewMode: state.viewMode,
    splitRatio: state.splitRatio,
    fileType: state.fileType,
    createdAt: state.createdAt,
    lastModified: state.lastModified,
    lastSaved: state.lastSaved,
    cursor: state.cursor,
    scrollTop: state.scrollTop,
    crepe: state.crepe,
    codeMirror: state.codeMirror,
    viewerState: state.viewerState,
  })
}

function toTabState(tab: Tab): TabState {
  return tab.toProps() as TabState
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref(new Map<string, TabState>())
  const activeTabId = ref<string | null>(null)
  const tabOrder = ref<string[]>([])

  // ── Computed ──────────────────────────────────────────

  const activeTab = computed(() => {
    if (!activeTabId.value) return null
    return tabs.value.get(activeTabId.value) || null
  })

  const dirtyTabs = computed(() => {
    return Array.from(tabs.value.values()).filter(tab => tab.isDirty)
  })

  const tabCount = computed(() => tabs.value.size)

  // ── Pure Data Operations ──────────────────────────────
  // These methods only manage state, no business logic.

  function addTab(tab: TabState): void {
    tabs.value.set(tab.id, tab)
    tabOrder.value.push(tab.id)
  }

  function removeTabById(tabId: string): boolean {
    const tab = tabs.value.get(tabId)
    if (!tab) return false
    tabs.value.delete(tabId)
    tabOrder.value = tabOrder.value.filter(id => id !== tabId)
    return true
  }

  function setActiveTabId(tabId: string | null): void {
    activeTabId.value = tabId
  }

  function switchTab(tabId: string): void {
    if (!tabs.value.has(tabId)) return
    if (tabId === activeTabId.value) return
    const previousTabId = activeTabId.value
    activeTabId.value = tabId
    eventBus.emit(AppEvents.TAB_SWITCHED, { tabId, previousTabId: previousTabId || undefined })
  }

  function getTab(tabId: string): TabState | undefined {
    return tabs.value.get(tabId)
  }

  function updateTab(tabId: string, updates: Partial<TabState>): void {
    const tab = tabs.value.get(tabId)
    if (tab) {
      Object.assign(tab, updates)
      if (updates.isDirty !== undefined) {
        tab.isDirty = updates.isDirty
      }
    }
  }

  function markDirty(tabId: string): void {
    const tab = tabs.value.get(tabId)
    if (tab && !tab.isDirty) {
      tab.isDirty = true
      tab.lastModified = Date.now()
    }
  }

  function markClean(tabId: string): void {
    const tab = tabs.value.get(tabId)
    if (tab) {
      tab.isDirty = false
      tab.lastSaved = Date.now()
    }
  }

  function setViewMode(tabId: string, mode: ViewMode): void {
    const tab = tabs.value.get(tabId)
    if (tab) {
      tab.viewMode = mode
    }
  }

  function getAllTabs(): TabState[] {
    return tabOrder.value.map(id => tabs.value.get(id)!).filter(Boolean)
  }

  function getTabOrder(): string[] {
    return [...tabOrder.value]
  }

  function setTabOrder(newOrder: string[]): void {
    tabOrder.value = newOrder
  }

  // ── ITabRepository implementation ─────────────────────

  const getAll = (): Tab[] => getAllTabs().map(toTab)
  const getById = (id: string): Tab | undefined => {
    const state = getTab(id)
    return state ? toTab(state) : undefined
  }
  const create = (_options?: CreateTabOptions): Tab => {
    throw new Error('Use CreateTab Use Case instead of store.create()')
  }
  const insert = (tab: Tab): void => addTab(toTabState(tab))
  const update = (id: string, updates: Partial<TabUpdates>): void => {
    updateTab(id, updates as Partial<TabState>)
  }
  const deleteTab = (id: string): void => { removeTabById(id) }
  const getActiveTab = (): Tab | undefined => {
    const state = activeTab.value
    return state ? toTab(state) : undefined
  }
  const getActiveTabId = (): string | null => activeTabId.value
  const setActiveTab = (id: string): void => { setActiveTabId(id) }
  const getDirtyTabs = (): Tab[] => dirtyTabs.value.map(toTab)
  const findTabByFilePath = (filePath: string): Tab | undefined => {
    const state = Array.from(tabs.value.values()).find(t => t.filePath === filePath)
    return state ? toTab(state) : undefined
  }
  const getTabCount = (): number => tabCount.value
  const hasOpenFiles = (): boolean => tabCount.value > 0
  const setSplitRatio = (_id: string, _ratio: number): void => { /* store 不跟踪 */ }

  return {
    tabs,
    activeTabId,
    tabOrder,
    activeTab,
    dirtyTabs,
    tabCount,
    addTab,
    removeTabById,
    setActiveTabId,
    switchTab,
    getTab,
    findTabByFilePath,
    updateTab,
    markDirty,
    markClean,
    setViewMode,
    getAllTabs,
    getTabOrder,
    setTabOrder,
    // ITabRepository
    getAll,
    getById,
    create,
    insert,
    update,
    delete: deleteTab,
    getActiveTab,
    getActiveTabId,
    setActiveTab,
    getDirtyTabs,
    setSplitRatio,
    getTabCount,
    hasOpenFiles,
  }
})
