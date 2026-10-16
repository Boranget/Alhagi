import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTabsStore } from '../tabs'
import type { TabState } from '@/types'

vi.mock('@/utils/tabHelpers', () => ({
  validateTabState: vi.fn(() => true),
  detectFileType: vi.fn(() => 'markdown'),
  createDefaultTabState: vi.fn((_id: string) => ({})),
  createDefaultEditorState: vi.fn(() => ({ cursor: { from: 0, to: 0 }, scrollTop: 0 })),
}))

function createTestTab(overrides: Partial<TabState> = {}): TabState {
  return {
    id: overrides.id || `tab-${Date.now()}-${Math.random()}`,
    filePath: null,
    content: '',
    isDirty: false,
    title: 'Test Tab',
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'markdown',
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    ...overrides,
  }
}

describe('Tabs Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty tabs', () => {
      const store = useTabsStore()
      expect(store.tabs.size).toBe(0)
      expect(store.activeTabId).toBeNull()
      expect(store.tabCount).toBe(0)
    })
  })

  describe('addTab', () => {
    it('should add a tab', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1', title: 'My Tab' })
      store.addTab(tab)

      expect(store.tabs.size).toBe(1)
      expect(store.getTab('tab-1')?.title).toBe('My Tab')
    })

    it('should add tab to tabOrder', () => {
      const store = useTabsStore()
      const tab1 = createTestTab({ id: 'tab-1' })
      const tab2 = createTestTab({ id: 'tab-2' })
      store.addTab(tab1)
      store.addTab(tab2)

      expect(store.tabOrder).toEqual(['tab-1', 'tab-2'])
    })
  })

  describe('removeTabById', () => {
    it('should remove tab', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1' })
      store.addTab(tab)

      const result = store.removeTabById('tab-1')

      expect(result).toBe(true)
      expect(store.tabs.size).toBe(0)
    })

    it('should return false for nonexistent tab', () => {
      const store = useTabsStore()
      expect(store.removeTabById('nonexistent')).toBe(false)
    })

    it('should remove from tabOrder', () => {
      const store = useTabsStore()
      const tab1 = createTestTab({ id: 'tab-1' })
      const tab2 = createTestTab({ id: 'tab-2' })
      store.addTab(tab1)
      store.addTab(tab2)

      store.removeTabById('tab-1')

      expect(store.tabOrder).toEqual(['tab-2'])
    })
  })

  describe('setActiveTabId', () => {
    it('should set active tab id', () => {
      const store = useTabsStore()
      store.setActiveTabId('tab-1')
      expect(store.activeTabId).toBe('tab-1')
    })
  })

  describe('switchTab', () => {
    it('should switch active tab', () => {
      const store = useTabsStore()
      const tab1 = createTestTab({ id: 'tab-1' })
      const tab2 = createTestTab({ id: 'tab-2' })
      store.addTab(tab1)
      store.addTab(tab2)
      store.setActiveTabId('tab-1')

      store.switchTab('tab-2')

      expect(store.activeTabId).toBe('tab-2')
    })

    it('should not switch to nonexistent tab', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1' })
      store.addTab(tab)
      store.setActiveTabId('tab-1')

      store.switchTab('nonexistent')

      expect(store.activeTabId).toBe('tab-1')
    })

    it('should not switch if already active', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1' })
      store.addTab(tab)
      store.setActiveTabId('tab-1')

      store.switchTab('tab-1')

      expect(store.activeTabId).toBe('tab-1')
    })
  })

  describe('updateTab', () => {
    it('should update tab fields', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1', title: 'Original' })
      store.addTab(tab)

      store.updateTab('tab-1', { title: 'Updated' })

      expect(store.getTab('tab-1')?.title).toBe('Updated')
    })
  })

  describe('markDirty / markClean', () => {
    it('should mark tab dirty', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1' })
      store.addTab(tab)

      store.markDirty('tab-1')

      expect(store.getTab('tab-1')?.isDirty).toBe(true)
    })

    it('should mark tab clean', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1', isDirty: true })
      store.addTab(tab)

      store.markClean('tab-1')

      expect(store.getTab('tab-1')?.isDirty).toBe(false)
    })
  })

  describe('markCleanIfUnchanged', () => {
    it('内容与落盘快照一致时清除 dirty 并记录 lastSaved', () => {
      const store = useTabsStore()
      store.addTab(createTestTab({ id: 'tab-1', content: 'v1', isDirty: true }))

      const cleaned = store.markCleanIfUnchanged('tab-1', 'v1')

      expect(cleaned).toBe(true)
      expect(store.getTab('tab-1')?.isDirty).toBe(false)
      expect(store.getTab('tab-1')?.lastSaved).not.toBeNull()
    })

    it('保存期间有新编辑（内容≠快照）时保持 dirty', () => {
      const store = useTabsStore()
      store.addTab(createTestTab({ id: 'tab-1', content: 'v2', isDirty: true }))

      const cleaned = store.markCleanIfUnchanged('tab-1', 'v1')

      expect(cleaned).toBe(false)
      expect(store.getTab('tab-1')?.isDirty).toBe(true)
      expect(store.getTab('tab-1')?.lastSaved).toBeNull()
    })

    it('tab 不存在时返回 false', () => {
      const store = useTabsStore()
      expect(store.markCleanIfUnchanged('missing', 'v1')).toBe(false)
    })
  })

  describe('computed', () => {
    it('activeTab should return the active tab', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1' })
      store.addTab(tab)
      store.setActiveTabId('tab-1')
      expect(store.activeTab?.id).toBe('tab-1')
    })

    it('dirtyTabs should return only dirty tabs', () => {
      const store = useTabsStore()
      const tab1 = createTestTab({ id: 'tab-1', isDirty: true })
      const tab2 = createTestTab({ id: 'tab-2', isDirty: false })
      store.addTab(tab1)
      store.addTab(tab2)

      expect(store.dirtyTabs.length).toBe(1)
      expect(store.dirtyTabs[0].id).toBe('tab-1')
    })

    it('tabCount should return number of tabs', () => {
      const store = useTabsStore()
      store.addTab(createTestTab({ id: 'tab-1' }))
      store.addTab(createTestTab({ id: 'tab-2' }))
      expect(store.tabCount).toBe(2)
    })
  })

  describe('findTabByFilePath', () => {
    it('should find tab by file path', () => {
      const store = useTabsStore()
      const tab = createTestTab({ id: 'tab-1', filePath: '/path/to/file.md' })
      store.addTab(tab)

      expect(store.findTabByFilePath('/path/to/file.md')?.id).toBe('tab-1')
    })

    it('should return undefined for unknown path', () => {
      const store = useTabsStore()
      expect(store.findTabByFilePath('/unknown')).toBeUndefined()
    })
  })
})
