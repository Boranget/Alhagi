import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TabState, ViewMode } from '@/types'
import { trimHistoryStacks, MAX_UNDO_STACK_SIZE, MAX_REDO_STACK_SIZE } from '@/utils/tabHelpers'
import { eventBus, AppEvents } from '@/events/eventBus'

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

  function findTabByFilePath(filePath: string): TabState | undefined {
    return Array.from(tabs.value.values()).find(t => t.filePath === filePath)
  }

  function updateTab(tabId: string, updates: Partial<TabState>): void {
    const tab = tabs.value.get(tabId)
    if (tab) {
      Object.assign(tab, updates)
      if (updates.isDirty !== undefined) {
        tab.isDirty = updates.isDirty
      }
      if (tab.crepe.undoStack.length > MAX_UNDO_STACK_SIZE || tab.crepe.redoStack.length > MAX_REDO_STACK_SIZE) {
        trimHistoryStacks(tab.crepe)
      }
      if (tab.codeMirror.undoStack.length > MAX_UNDO_STACK_SIZE || tab.codeMirror.redoStack.length > MAX_REDO_STACK_SIZE) {
        trimHistoryStacks(tab.codeMirror)
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
  }
})
