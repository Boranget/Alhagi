import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TabState, ViewMode, FileType } from '@/types'
import { generateUUID } from '@/utils/helpers'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { TABS, EDITOR, FILE } from '@/constants'

export function validateTabState(tabState: unknown): tabState is TabState {
  if (!tabState || typeof tabState !== 'object') {
    return false
  }
  
  const obj = tabState as Record<string, unknown>
  const requiredFields = [
    'id', 'filePath', 'content', 'isDirty', 'title', 'active',
    'cursor', 'scrollTop', 'viewMode', 'fileType', 'undoStack', 'redoStack',
    'createdAt', 'lastModified', 'lastSaved'
  ]

  for (const field of requiredFields) {
    if (!(field in obj)) {
      return false
    }
  }

  if (typeof obj.id !== 'string' || !obj.id) {
    return false
  }

  if (typeof obj.content !== 'string') {
    return false
  }

  if (typeof obj.cursor !== 'object' || 
      typeof (obj.cursor as Record<string, unknown>)?.from !== 'number' || 
      typeof (obj.cursor as Record<string, unknown>)?.to !== 'number') {
    return false
  }

  if (![EDITOR.VIEW_MODES.WYSIWYG, EDITOR.VIEW_MODES.SOURCE, EDITOR.VIEW_MODES.SPLIT].includes(obj.viewMode as ViewMode)) {
    return false
  }

  if (!['editor', 'image', 'unsupported'].includes(obj.fileType as string)) {
    return false
  }

  if (!Array.isArray(obj.undoStack) || !Array.isArray(obj.redoStack)) {
    return false
  }

  return true
}

export function detectFileType(filePath: string | null): FileType {
  if (!filePath) {
    return 'editor'
  }
  
  const ext = filePath.split('.').pop()?.toLowerCase()
  
  if (!ext) {
    return 'unsupported'
  }
  
  if (FILE.MARKDOWN_EXTENSIONS.some(mdExt => mdExt === `.${ext}`)) {
    return 'editor'
  }
  
  if (FILE.IMAGE_EXTENSIONS.some(imgExt => imgExt === `.${ext}`)) {
    return 'image'
  }
  
  return 'unsupported'
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
    fileType: 'editor',
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
      active: false,
      cursor: { from: 0, to: 0 },
      scrollTop: 0,
      viewMode: options.viewMode || EDITOR.VIEW_MODES.WYSIWYG,
      fileType,
      undoStack: [],
      redoStack: [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null
    }

    if (!validateTabState(tab)) {
      Object.assign(tab, createDefaultTabState(id))
    }

    tabs.value.set(id, tab)
    tabOrder.value.push(id)

    if (options.filePath) {
      const prefs = usePreferencesStore()
      prefs.addRecentFile(options.filePath, tab.title)
    }

    activeTabId.value = id
    tab.active = true

    eventBus.emit(AppEvents.TAB_CREATED, { tabId: id, tab })

    syncOpenedFiles()

    return tab
  }

  function removeTab(tabId: string): boolean {
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

    syncOpenedFiles()

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
    getAllTabs
  }
})