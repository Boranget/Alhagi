import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TabState, ViewMode, FileType } from '@/types'
import { generateUUID } from '@/utils/helpers'
import { 
  validateTabState, 
  detectFileType, 
  createDefaultTabState, 
  trimHistoryStacks,
  createDefaultEditorState,
  MAX_UNDO_STACK_SIZE,
  MAX_REDO_STACK_SIZE 
} from '@/utils/tabHelpers'
import { eventBus, AppEvents } from '@/events/eventBus'
import { TABS, EDITOR } from '@/constants'

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref(new Map<string, TabState>())
  const activeTabId = ref<string | null>(null)
  const tabOrder = ref<string[]>([])

  async function syncOpenedFiles() {
    if (!window.electronAPI) return
    const filePaths = Array.from(tabs.value.values())
      .map(tab => tab.filePath)
      .filter((filePath): filePath is string => filePath !== null)
    await window.electronAPI.updateOpenedFiles(filePaths)
  }

  const activeTab = computed(() => {
    if (!activeTabId.value) return null
    return tabs.value.get(activeTabId.value) || null
  })

  const dirtyTabs = computed(() => {
    return Array.from(tabs.value.values()).filter(tab => tab.isDirty)
  })

  const tabCount = computed(() => tabs.value.size)

  function generateUntitledTitle(): string {
    const untitledCount = Array.from(tabs.value.values()).filter(tab => 
      tab.title.startsWith(TABS.NEW_TAB_TITLE)
    ).length
    if (untitledCount === 0) {
      return TABS.NEW_TAB_TITLE
    }
    return `${TABS.NEW_TAB_TITLE}-${untitledCount}`
  }

  function getTab(tabId: string): TabState | undefined {
    return tabs.value.get(tabId)
  }

  function findTabByFilePath(filePath: string): TabState | undefined {
    return Array.from(tabs.value.values()).find(t => t.filePath === filePath)
  }

  function createTab(options: {
    filePath?: string
    content?: string
    title?: string
    viewMode?: ViewMode
    fileType?: FileType
    splitRatio?: number
  } = {}): TabState {
    const id = generateUUID()
    const filePath = options.filePath || null
    const fileType = options.fileType || detectFileType(filePath)
    
    const tab: TabState = {
      id,
      filePath,
      content: options.content || '',
      isDirty: false,
      title: options.title || generateUntitledTitle(),
      viewMode: options.viewMode || EDITOR.VIEW_MODES.WYSIWYG,
      splitRatio: options.splitRatio ?? 50,
      fileType,
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null,
      crepe: createDefaultEditorState(),
      codeMirror: createDefaultEditorState()
    }

    if (!validateTabState(tab)) {
      Object.assign(tab, createDefaultTabState(id))
    }

    tabs.value.set(id, tab)
    tabOrder.value.push(id)

    if (options.filePath) {
      eventBus.emit(AppEvents.FILE_OPENED, { filePath: options.filePath, tabId: id })
    }

    const previousTabId = activeTabId.value
    activeTabId.value = id

    console.log(`[TabsStore] createTab: id=${id}, title="${tab.title}", filePath=${tab.filePath}, prevActive=${previousTabId}, order=[${tabOrder.value.join(',')}]`)

    eventBus.emit(AppEvents.TAB_CREATED, { tabId: id, tab })

    if (previousTabId && previousTabId !== id) {
      eventBus.emit(AppEvents.TAB_SWITCHED, { tabId: id, previousTabId })
    }

    syncOpenedFiles()

    return tab
  }

  function removeTab(tabId: string): boolean {
    const tab = tabs.value.get(tabId)
    if (!tab) {
      console.warn('[TabsStore] removeTab aborted: tab not found', { tabId })
      return false
    }

    const currentIndex = tabOrder.value.indexOf(tabId)
    if (currentIndex === -1) {
      console.warn('[TabsStore] removeTab aborted: tabId not in tabOrder', { tabId })
      return false
    }

    console.log(`[TabsStore] removeTab: id=${tabId}, title="${tab.title}", idx=${currentIndex}, wasActive=${activeTabId.value === tabId}, order=[${tabOrder.value.join(',')}]`)

    tabs.value.delete(tabId)
    tabOrder.value = tabOrder.value.filter(id => id !== tabId)

    eventBus.emit(AppEvents.TAB_CLOSED, { tabId, tab })

    if (activeTabId.value === tabId) {
      if (tabOrder.value.length > 0) {
        const rightIndex = currentIndex
        const leftIndex = currentIndex - 1

        let nextTabId: string | null = null
        if (rightIndex < tabOrder.value.length) {
          nextTabId = tabOrder.value[rightIndex]
        } else if (leftIndex >= 0) {
          nextTabId = tabOrder.value[leftIndex]
        }

        if (nextTabId) {
          console.log(`[TabsStore] removeTab: switch to neighbor ${nextTabId} (right=${rightIndex}, left=${leftIndex})`)
          switchTab(nextTabId)
        } else {
          activeTabId.value = null
          console.log(`[TabsStore] removeTab: no tabs left, activeTabId=null`)
        }
      } else {
        activeTabId.value = null
        console.log(`[TabsStore] removeTab: last tab closed, activeTabId=null`)
      }
    }

    console.log(`[TabsStore] removeTab done: order=[${tabOrder.value.join(',')}], active=${activeTabId.value}`)

    syncOpenedFiles()

    return true
  }

  function switchTab(tabId: string): void {
    console.log(`[TabsStore] switchTab called: tabId=${tabId}, currentActiveTabId=${activeTabId.value}`)

    if (!tabs.value.has(tabId)) {
      console.warn(`[TabsStore] switchTab aborted: tab not found: ${tabId}`)
      return
    }
    if (tabId === activeTabId.value) {
      console.log(`[TabsStore] switchTab aborted: already active: ${tabId}`)
      return
    }

    const previousTabId = activeTabId.value
    activeTabId.value = tabId

    const tab = tabs.value.get(tabId)
    const contentLen = tab?.content?.length ?? 0
    const preview = tab?.content?.substring(0, 50)?.replace(/\n/g, '\\n') ?? ''
    console.log(`[TabsStore] switchTab done: ${previousTabId} → ${tabId}, content=${contentLen}chars "${preview}", order=[${tabOrder.value.join(',')}]`)

    eventBus.emit(AppEvents.TAB_SWITCHED, { tabId, previousTabId: previousTabId || undefined })
  }

  function updateTab(tabId: string, updates: Partial<TabState>): void {
    console.log('[TabsStore] updateTab called', { tabId, updates: Object.keys(updates), isDirty: updates.isDirty })
    const tab = tabs.value.get(tabId)
    if (tab) {
      Object.assign(tab, updates)
      if (updates.isDirty !== undefined) {
        tab.isDirty = updates.isDirty
      }

      // 检查并裁剪每个编辑器的历史栈
      if (tab.crepe.undoStack.length > MAX_UNDO_STACK_SIZE || tab.crepe.redoStack.length > MAX_REDO_STACK_SIZE) {
        trimHistoryStacks(tab.crepe)
      }
      if (tab.codeMirror.undoStack.length > MAX_UNDO_STACK_SIZE || tab.codeMirror.redoStack.length > MAX_REDO_STACK_SIZE) {
        trimHistoryStacks(tab.codeMirror)
      }

      eventBus.emit(AppEvents.TAB_UPDATED, { tabId, updates })
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

  function setTabOrder(newOrder: string[]): void {
    console.log('[TabsStore] setTabOrder', { before: [...tabOrder.value], after: newOrder })
    tabOrder.value = newOrder
  }

  return {
    tabs,
    activeTabId,
    tabOrder,
    activeTab,
    dirtyTabs,
    tabCount,
    getTab,
    findTabByFilePath,
    createTab,
    removeTab,
    switchTab,
    updateTab,
    markDirty,
    markClean,
    setViewMode,
    getAllTabs,
    setTabOrder
  }
})