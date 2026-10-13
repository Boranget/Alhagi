import { describe, it, expect, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { restoreDetachedTab } from '../crossWindowTab'
import { useTabsStore } from '@/stores/tabs'
import { useTabActions } from '@/composables/useTabActions'
import type { DetachedTabData } from '@electron-protocol/index'

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

  it('异常不向上抛出', async () => {
    await expect(
      restoreDetachedTab(makeTabData({ title: 'x.md', filePath: '/docs/x.md' }))
    ).resolves.toBeUndefined()
  })
})
