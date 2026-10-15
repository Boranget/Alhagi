import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { restoreDetachedTab, beginTabTransfer, confirmTabTransferred } from '../crossWindowTab'
import { useTabsStore } from '@/stores/tabs'
import { useTabActions } from '@/composables/useTabActions'
import type { DetachedTabData } from '@electron-protocol/index'

const { mockElectronService } = vi.hoisted(() => ({
  mockElectronService: {
    notifyTabMergeComplete: vi.fn(),
  },
}))

vi.mock('@/services/electron/ElectronService', () => ({
  electronService: mockElectronService,
}))

// 注意：DI 容器是进程级单例，CreateTab/TabRepository 在首次解析时会绑定
// 当前 pinia 的 store。因此本文件固定使用同一个 pinia，用例间以
// tabCount 差值断言（不依赖执行顺序）。
function makeTabData(overrides: Partial<DetachedTabData> = {}): DetachedTabData {
  return {
    id: 'src-tab-id',
    title: 'note.md',
    content: '# from other window',
    filePath: '/docs/note.md',
    isDirty: false,
    viewMode: 'wysiwyg',
    cursor: { from: 0, to: 0 },
    ...overrides,
  }
}

describe('restoreDetachedTab', () => {
  beforeAll(() => {
    setActivePinia(createPinia())
  })

  it('恢复携带的 tab：内容/标题/路径保留，新 tab 成为活动 tab', async () => {
    const store = useTabsStore()
    const before = store.tabCount

    await restoreDetachedTab(makeTabData({ isDirty: true }))

    expect(store.tabCount).toBe(before + 1)
    const tab = store.activeTab!
    expect(tab.title).toBe('note.md')
    expect(tab.content).toBe('# from other window')
    expect(tab.filePath).toBe('/docs/note.md')
    expect(tab.isDirty).toBe(true)
  })

  it('目标窗口已打开同 filePath 时幂等：只切换不重复创建', async () => {
    const store = useTabsStore()
    const { createTab } = useTabActions()
    const existing = await createTab({
      title: 'local.md',
      content: 'local content',
      filePath: '/docs/local.md',
    })
    const baseline = store.tabCount

    await restoreDetachedTab(
      makeTabData({ filePath: '/docs/local.md', content: 'remote content' })
    )

    expect(store.tabCount).toBe(baseline)
    expect(store.activeTabId).toBe(existing.id)
    // 本地内容不被覆盖
    expect(store.activeTab!.content).toBe('local content')
  })

  it('无 filePath 的 tab 每次都创建（不误判重复）', async () => {
    const store = useTabsStore()
    const before = store.tabCount

    await restoreDetachedTab(makeTabData({ filePath: null }))
    await restoreDetachedTab(makeTabData({ filePath: null }))

    expect(store.tabCount).toBe(before + 2)
  })

  it('恢复的 tab fileType 按路径重算（不信任传输数据）：.txt → text', async () => {
    const store = useTabsStore()
    const before = store.tabCount

    await restoreDetachedTab(
      makeTabData({ title: 'log.txt', filePath: '/docs/log.txt', content: 'plain' })
    )

    expect(store.tabCount).toBe(before + 1)
    // DetachedTabData 不携带 fileType —— 恢复一律走 detectFileType(filePath)
    expect(store.activeTab!.fileType).toBe('text')
  })

  it('异常不向上抛出', async () => {
    await expect(
      restoreDetachedTab(makeTabData({ title: 'x.md', filePath: '/docs/x.md' }))
    ).resolves.toBeUndefined()
  })
})

describe('传输回执（ack）', () => {
  // 不换 pinia：DI 容器（TabRepository）绑定的是文件首个 pinia 的 store，
  // 换新 pinia 会导致 createTab 与 useTabsStore 读写不同实例。
  beforeEach(() => {
    mockElectronService.notifyTabMergeComplete.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('restoreDetachedTab 回发 ack', () => {
    it('恢复成功且携带 sourceWindowId 时通知源窗口', async () => {
      await restoreDetachedTab(makeTabData({ sourceWindowId: 7 }))

      expect(mockElectronService.notifyTabMergeComplete).toHaveBeenCalledWith({
        sourceWindowId: 7,
        originalTabId: 'src-tab-id',
      })
    })

    it('幂等复用已有 tab 时同样回发 ack', async () => {
      const { createTab } = useTabActions()
      await createTab({ title: 'local.md', content: '', filePath: '/docs/local.md' })
      mockElectronService.notifyTabMergeComplete.mockClear()

      await restoreDetachedTab(
        makeTabData({ filePath: '/docs/local.md', sourceWindowId: 7 })
      )

      expect(mockElectronService.notifyTabMergeComplete).toHaveBeenCalledWith({
        sourceWindowId: 7,
        originalTabId: 'src-tab-id',
      })
    })

    it('无 sourceWindowId（旧协议/会话恢复）时静默跳过', async () => {
      await restoreDetachedTab(makeTabData({ filePath: null }))

      expect(mockElectronService.notifyTabMergeComplete).not.toHaveBeenCalled()
    })
  })

  describe('beginTabTransfer / confirmTabTransferred', () => {
    it('ack 在超时前到达：删除源 tab', async () => {
      const store = useTabsStore()
      const { createTab } = useTabActions()
      const tab = await createTab({ title: 'a.md', content: '' })

      beginTabTransfer(tab.id)
      await confirmTabTransferred(tab.id)

      expect(store.getTab(tab.id)).toBeUndefined()
    })

    it('ack 超时：保留源 tab（数据安全优先），此后到达的 ack 也不再删除', async () => {
      const store = useTabsStore()
      const { createTab } = useTabActions()
      const tab = await createTab({ title: 'b.md', content: '' })

      beginTabTransfer(tab.id)
      vi.advanceTimersByTime(5100)
      // 超时已放弃删除；迟到的 ack 必须是 no-op
      await confirmTabTransferred(tab.id)

      expect(store.getTab(tab.id)).toBeDefined()
    })

    it('未登记的 tabId 收到 ack 时静默忽略', async () => {
      await expect(confirmTabTransferred('never-transferred')).resolves.toBeUndefined()
    })
  })
})
