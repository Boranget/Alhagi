import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAutoSave } from '../useAutoSave'
import { useTabsStore } from '../../stores/tabs'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { TabState } from '@/types'

const { mockSaveFile, mockPrefs } = vi.hoisted(() => ({
  mockSaveFile: vi.fn<(tabId: string) => Promise<boolean>>(),
  mockPrefs: { autoSave: false, autoSaveInterval: 1 },
}))

vi.mock('@/services/tabService', () => ({
  useTabService: () => ({ saveFile: mockSaveFile }),
}))

vi.mock('@/stores/preferences', () => ({
  usePreferencesStore: () => mockPrefs,
}))

function createFakeBus(): IEventBus {
  return {
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    emit: vi.fn(),
    once: vi.fn(() => () => {}),
    subscribe: vi.fn(() => () => {}),
    clear: vi.fn(),
    hasListeners: vi.fn(() => false),
    getListenerCount: vi.fn(() => 0),
  } as unknown as IEventBus
}

function makeTab(overrides: Partial<TabState>): TabState {
  return {
    id: 't1',
    filePath: '/docs/a.md',
    content: 'base',
    isDirty: false,
    title: 'a.md',
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'editor',
    createdAt: 0,
    lastModified: 0,
    lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    ...overrides,
  }
}

describe('useAutoSave.performAutoSave', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPrefs.autoSave = false
    mockPrefs.autoSaveInterval = 1
    mockSaveFile.mockReset()
    mockSaveFile.mockResolvedValue(true)
  })

  // 回归护栏：CONTENT_CHANGED 只在 tab 活动期发出，防抖窗口内切走后，
  // 旧的「只存活动 tab」写法会让原 tab 的 dirty 永无触发源。
  it('保存全部 dirty tab，而非仅活动 tab（防抖窗口内切走的回归）', async () => {
    const store = useTabsStore()
    store.addTab(makeTab({ id: 'a', filePath: '/docs/a.md', isDirty: true, content: 'edited' }))
    store.addTab(makeTab({ id: 'b', filePath: '/docs/b.md', isDirty: false, title: 'b.md' }))
    store.setActiveTabId('b')

    const { performAutoSave } = useAutoSave(createFakeBus())
    await performAutoSave()

    expect(mockSaveFile).toHaveBeenCalledTimes(1)
    expect(mockSaveFile).toHaveBeenCalledWith('a')
  })

  it('多个 dirty tab 依次全部保存，clean tab 不保存', async () => {
    const store = useTabsStore()
    store.addTab(makeTab({ id: 'a', filePath: '/docs/a.md', isDirty: true }))
    store.addTab(makeTab({ id: 'b', filePath: '/docs/b.md', isDirty: true, title: 'b.md' }))
    store.addTab(makeTab({ id: 'c', filePath: '/docs/c.md', isDirty: false, title: 'c.md' }))

    const { performAutoSave } = useAutoSave(createFakeBus())
    await performAutoSave()

    expect(mockSaveFile.mock.calls.map(call => call[0])).toEqual(['a', 'b'])
  })

  it('跳过无 filePath 的 dirty tab（不触发另存为对话框）', async () => {
    const store = useTabsStore()
    store.addTab(makeTab({ id: 'no-path', filePath: null, isDirty: true }))

    const { performAutoSave, autoSaveError } = useAutoSave(createFakeBus())
    await performAutoSave()

    expect(mockSaveFile).not.toHaveBeenCalled()
    expect(autoSaveError.value).toBeNull()
  })

  it('无 dirty tab 时不调用保存', async () => {
    useTabsStore().addTab(makeTab({ id: 'a', isDirty: false }))

    const { performAutoSave } = useAutoSave(createFakeBus())
    await performAutoSave()

    expect(mockSaveFile).not.toHaveBeenCalled()
  })

  // performAutoSave 自己不许清 dirty——清位是 saveFile（写盘成功且期间
  // 权威未变）的职责；单文件失败也不阻断其余 tab。
  it('保存失败：报告错误、isDirty 不由本层清除，其余 tab 继续保存', async () => {
    const store = useTabsStore()
    store.addTab(makeTab({ id: 'a', filePath: '/docs/a.md', isDirty: true }))
    store.addTab(makeTab({ id: 'b', filePath: '/docs/b.md', isDirty: true, title: 'b.md' }))
    mockSaveFile.mockImplementation(async (id: string) => id !== 'a')

    const { performAutoSave, autoSaveError } = useAutoSave(createFakeBus())
    await performAutoSave()

    expect(mockSaveFile).toHaveBeenCalledTimes(2)
    expect(autoSaveError.value).toBe('Failed to auto-save')
    expect(store.getTab('a')!.isDirty).toBe(true)
  })
})

describe('useAutoSave 防抖生命周期', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPrefs.autoSave = true
    mockPrefs.autoSaveInterval = 1
    mockSaveFile.mockReset()
    mockSaveFile.mockResolvedValue(true)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('防抖到点后执行保存', async () => {
    useTabsStore().addTab(makeTab({ id: 'a', filePath: '/docs/a.md', isDirty: true }))

    const { startAutoSave } = useAutoSave(createFakeBus())
    startAutoSave()
    await vi.advanceTimersByTimeAsync(1000)

    expect(mockSaveFile).toHaveBeenCalledWith('a')
  })

  it('stopAutoSave 撤销挂起的那次：停用后不再落盘', async () => {
    useTabsStore().addTab(makeTab({ id: 'a', filePath: '/docs/a.md', isDirty: true }))

    const { startAutoSave, stopAutoSave } = useAutoSave(createFakeBus())
    startAutoSave()
    stopAutoSave()
    await vi.advanceTimersByTimeAsync(3000)

    expect(mockSaveFile).not.toHaveBeenCalled()
  })
})
