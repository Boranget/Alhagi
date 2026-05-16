import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TabState, ViewMode } from '@/types'
import { generateUUID } from '@/utils/helpers'

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
      title: options.title || '未命名',
      active: false,
      cursor: { from: 0, to: 0 },
      scrollTop: 0,
      viewMode: options.viewMode || 'wysiwyg',
      undoStack: [],
      redoStack: [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null
    }
    
    tabs.value.set(id, tab)
    tabOrder.value.push(id)
    
    if (!activeTabId.value) {
      activeTabId.value = id
      tab.active = true
    }
    
    return tab
  }

  function removeTab(tabId: string) {
    if (tabOrder.value.length === 1 && activeTabId.value === tabId) {
      return false
    }

    tabs.value.delete(tabId)
    tabOrder.value = tabOrder.value.filter(id => id !== tabId)
    
    if (activeTabId.value === tabId) {
      if (tabOrder.value.length > 0) {
        const index = tabOrder.value.indexOf(tabId)
        const nextIndex = Math.min(index, tabOrder.value.length - 1)
        activeTabId.value = tabOrder.value[nextIndex]
        const nextTab = tabs.value.get(activeTabId.value)
        if (nextTab) {
          nextTab.active = true
        }
      } else {
        activeTabId.value = null
      }
    }
    
    return true
  }

  function switchTab(tabId: string) {
    if (!tabs.value.has(tabId) || tabId === activeTabId.value) {
      return
    }
    
    const currentTab = activeTab.value
    if (currentTab) {
      currentTab.active = false
    }
    
    activeTabId.value = tabId
    const tab = tabs.value.get(tabId)
    if (tab) {
      tab.active = true
    }
  }

  function updateTab(tabId: string, updates: Partial<TabState>) {
    const tab = tabs.value.get(tabId)
    if (tab) {
      Object.assign(tab, updates)
      if (updates.isDirty !== undefined) {
        tab.isDirty = updates.isDirty
      }
    }
  }

  function markDirty(tabId: string) {
    const tab = tabs.value.get(tabId)
    if (tab && !tab.isDirty) {
      tab.isDirty = true
      tab.lastModified = Date.now()
    }
  }

  function markClean(tabId: string) {
    const tab = tabs.value.get(tabId)
    if (tab) {
      tab.isDirty = false
      tab.lastSaved = Date.now()
    }
  }

  function setViewMode(tabId: string, mode: ViewMode) {
    const tab = tabs.value.get(tabId)
    if (tab) {
      tab.viewMode = mode
    }
  }

  async function openFile() {
    if (!window.electronAPI) return null
    
    const result = await window.electronAPI.openFile()
    if (!result) return null

    const { filePath, content } = result
    
    const existingTab = Array.from(tabs.value.values()).find(t => t.filePath === filePath)
    if (existingTab) {
      switchTab(existingTab.id)
      return existingTab
    }

    const title = filePath.split(/[/\\]/).pop()?.replace(/\.md$/i, '') || '未命名'
    const tab = createTab({ filePath, content, title })
    switchTab(tab.id)
    
    return tab
  }

  async function saveFile(tabId: string) {
    const tab = tabs.value.get(tabId)
    if (!tab) return false

    if (!window.electronAPI) return false

    if (tab.filePath) {
      await window.electronAPI.saveFile(tab.filePath, tab.content)
      markClean(tabId)
      return true
    } else {
      return await saveFileAs(tabId)
    }
  }

  async function saveFileAs(tabId: string) {
    const tab = tabs.value.get(tabId)
    if (!tab || !window.electronAPI) return false

    const defaultPath = tab.title + '.md'
    const filePath = await window.electronAPI.saveAsFile(tab.content, defaultPath)
    
    if (filePath) {
      tab.filePath = filePath
      tab.title = filePath.split(/[/\\]/).pop()?.replace(/\.md$/i, '') || '未命名'
      markClean(tabId)
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
    saveFile,
    saveFileAs,
    getAllTabs
  }
})
