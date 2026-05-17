import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TabState, ViewMode } from '@/types'
import { generateUUID, extractTitleFromPath } from '@/utils/helpers'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { TABS, EDITOR } from '@/constants'

export function validateTabState(tabState: unknown): tabState is TabState {
  if (!tabState || typeof tabState !== 'object') {
    return false
  }
  
  const obj = tabState as Record<string, unknown>
  const requiredFields = [
    'id', 'filePath', 'content', 'isDirty', 'title', 'active',
    'cursor', 'scrollTop', 'viewMode', 'undoStack', 'redoStack',
    'createdAt', 'lastModified', 'lastSaved'
  ]

  for (const field of requiredFields) {
    if (!(field in obj)) {
      console.error(`Missing required field: ${field}`)
      return false
    }
  }

  if (typeof obj.id !== 'string' || !obj.id) {
    console.error('Invalid id field')
    return false
  }

  if (typeof obj.content !== 'string') {
    console.error('Invalid content field')
    return false
  }

  if (typeof obj.cursor !== 'object' || 
      typeof (obj.cursor as Record<string, unknown>)?.from !== 'number' || 
      typeof (obj.cursor as Record<string, unknown>)?.to !== 'number') {
    console.error('Invalid cursor field')
    return false
  }

  if (![EDITOR.VIEW_MODES.WYSIWYG, EDITOR.VIEW_MODES.SOURCE, EDITOR.VIEW_MODES.SPLIT].includes(obj.viewMode as string)) {
    console.error('Invalid viewMode field')
    return false
  }

  if (!Array.isArray(obj.undoStack) || !Array.isArray(obj.redoStack)) {
    console.error('Invalid history stacks')
    return false
  }

  return true
}

export function createDefaultTabState(id: string): TabState {
  return {
    id,
    filePath: null,
    content: '',
    isDirty: false,
    title: TABS.NEW_TAB_TITLE,
    active: false,
    cursor: { from: 0, to: 0 },
    scrollTop: 0,
    viewMode: EDITOR.VIEW_MODES.WYSIWYG,
    undoStack: [],
    redoStack: [],
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null
  }
}

const MAX_UNDO_STACK_SIZE = EDITOR.MAX_UNDO_STACK_SIZE
const MAX_REDO_STACK_SIZE = EDITOR.MAX_REDO_STACK_SIZE

function trimHistoryStacks(tab: TabState): void {
  if (tab.undoStack.length > MAX_UNDO_STACK_SIZE) {
    tab.undoStack = tab.undoStack.slice(-MAX_UNDO_STACK_SIZE)
  }
  if (tab.redoStack.length > MAX_REDO_STACK_SIZE) {
    tab.redoStack = tab.redoStack.slice(-MAX_REDO_STACK_SIZE)
  }
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref(new Map<string, TabState>())
  const activeTabId = ref<string | null>(null)
  const tabOrder = ref<string[]>([])

  const activeTab = computed(() => {
    if (!activeTabId.value) return null
    return tabs.value.get(activeTabId.value) || null
  })

  const dirtyTabs = computed(() => {
    return Array.from(tabs.value.values()).filter(tab => tab.isDirty)
  })

  const tabCount = computed(() => tabs.value.size)

  function createTab(options: {
    filePath?: string
    content?: string
    title?: string
    viewMode?: ViewMode
  } = {}): TabState {
    const id = generateUUID()
    const tab: TabState = {
      id,
      filePath: options.filePath || null,
      content: options.content || '',
      isDirty: false,
      title: options.title || TABS.NEW_TAB_TITLE,
      active: false,
      cursor: { from: 0, to: 0 },
      scrollTop: 0,
      viewMode: options.viewMode || EDITOR.VIEW_MODES.WYSIWYG,
      undoStack: [],
      redoStack: [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null
    }

    if (!validateTabState(tab)) {
      console.error('Invalid tab state created, using defaults')
      Object.assign(tab, createDefaultTabState(id))
    }

    tabs.value.set(id, tab)
    tabOrder.value.push(id)

    if (options.filePath) {
      const prefs = usePreferencesStore()
      prefs.addRecentFile(options.filePath, tab.title)
    }

    if (!activeTabId.value) {
      activeTabId.value = id
      tab.active = true
    }

    eventBus.emit(AppEvents.TAB_CREATED, { tabId: id, tab })

    return tab
  }

  function removeTab(tabId: string): boolean {
    if (tabOrder.value.length === 1 && activeTabId.value === tabId) {
      return false
    }

    const tab = tabs.value.get(tabId)
    tabs.value.delete(tabId)
    tabOrder.value = tabOrder.value.filter(id => id !== tabId)

    eventBus.emit(AppEvents.TAB_CLOSED, { tabId, tab })

    if (activeTabId.value === tabId) {
      if (tabOrder.value.length > 0) {
        const index = Math.max(0, tabOrder.value.length - 1)
        switchTab(tabOrder.value[index])
      } else {
        activeTabId.value = null
      }
    }

    return true
  }

  function switchTab(tabId: string): void {
    if (!tabs.value.has(tabId) || tabId === activeTabId.value) {
      return
    }

    tabs.value.forEach((tab) => {
      tab.active = tab.id === tabId
    })

    const previousTabId = activeTabId.value
    activeTabId.value = tabId

    const tab = tabs.value.get(tabId)
    if (tab && tab.filePath) {
      const prefs = usePreferencesStore()
      prefs.addRecentFile(tab.filePath, tab.title)
    }

    eventBus.emit(AppEvents.TAB_SWITCHED, { tabId, previousTabId: previousTabId || undefined })
  }

  function updateTab(tabId: string, updates: Partial<TabState>): void {
    const tab = tabs.value.get(tabId)
    if (tab) {
      Object.assign(tab, updates)
      if (updates.isDirty !== undefined) {
        tab.isDirty = updates.isDirty
      }

      if (tab.undoStack.length > MAX_UNDO_STACK_SIZE || tab.redoStack.length > MAX_REDO_STACK_SIZE) {
        trimHistoryStacks(tab)
      }

      eventBus.emit(AppEvents.TAB_UPDATED, { tabId, updates })
      
      // 只有从非编辑器来源更新内容时才发这个事件（编辑器自己会发）
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

  async function openFile(): Promise<TabState | null> {
    if (!window.electronAPI) return null

    const result = await window.electronAPI.openFile()
    if (!result) return null

    const { filePath, content } = result

    const existingTab = Array.from(tabs.value.values()).find(t => t.filePath === filePath)
    if (existingTab) {
      switchTab(existingTab.id)
      return existingTab
    }

    const title = extractTitleFromPath(filePath)
    const tab = createTab({ filePath, content, title })
    switchTab(tab.id)

    eventBus.emit(AppEvents.FILE_OPENED, { filePath, tabId: tab.id })

    return tab
  }

  async function openRecentFile(filePath: string): Promise<TabState | null> {
    const existingTab = Array.from(tabs.value.values()).find(t => t.filePath === filePath)
    if (existingTab) {
      switchTab(existingTab.id)
      return existingTab
    }

    if (!window.electronAPI) return null

    try {
      const content = await window.electronAPI.readFile(filePath)
      const title = extractTitleFromPath(filePath)
      const tab = createTab({ filePath, content, title })
      switchTab(tab.id)

      eventBus.emit(AppEvents.FILE_OPENED, { filePath, tabId: tab.id })
      return tab
    } catch (e) {
      console.error('Failed to open recent file:', e)
      return null
    }
  }

  async function saveFile(tabId: string): Promise<boolean> {
    const tab = tabs.value.get(tabId)
    if (!tab) return false

    if (!window.electronAPI) return false

    if (tab.filePath) {
      const prefs = usePreferencesStore()
      const lineEnding = prefs.lineEnding
      await window.electronAPI.saveFile(tab.filePath, tab.content, lineEnding)
      markClean(tabId)

      eventBus.emit(AppEvents.FILE_SAVED, { filePath: tab.filePath, tabId })
      return true
    } else {
      return await saveFileAs(tabId)
    }
  }

  async function saveFileAs(tabId: string): Promise<boolean> {
    const tab = tabs.value.get(tabId)
    if (!tab || !window.electronAPI) return false

    const prefs = usePreferencesStore()
    const lineEnding = prefs.lineEnding
    const defaultPath = (tab.title.endsWith('.md') ? tab.title : tab.title + '.md')
    const filePath = await window.electronAPI.saveAsFile(tab.content, defaultPath, lineEnding)

    if (filePath) {
      tab.filePath = filePath
      tab.title = extractTitleFromPath(filePath)
      markClean(tabId)

      prefs.addRecentFile(filePath, tab.title)

      eventBus.emit(AppEvents.FILE_SAVED, { filePath, tabId })
      return true
    }

    return false
  }

  function getAllTabs(): TabState[] {
    return tabOrder.value.map(id => tabs.value.get(id)!).filter(Boolean)
  }

  return {
    tabs,
    activeTabId,
    tabOrder,
    activeTab,
    dirtyTabs,
    tabCount,
    createTab,
    removeTab,
    switchTab,
    updateTab,
    markDirty,
    markClean,
    setViewMode,
    openFile,
    openRecentFile,
    saveFile,
    saveFileAs,
    getAllTabs
  }
})
