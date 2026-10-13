import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  closeTab: { execute: vi.fn().mockResolvedValue(undefined) },
  createTab: { execute: vi.fn() },
  switchTab: { execute: vi.fn() },
  updateTab: { execute: vi.fn() },
}))

vi.mock('@adapters/commandHandlers', () => ({
  getCreateTabUseCase: () => mocks.createTab,
  getCloseTabUseCase: () => mocks.closeTab,
  getSwitchTabUseCase: () => mocks.switchTab,
  getUpdateTabUseCase: () => mocks.updateTab,
}))

import { TabCommandHandler } from '../TabCommandHandler'
import { useTabsStore } from '@/stores/tabs'

describe('TabCommandHandler', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it("tab:remove 路由到 CloseTab use-case（而非 store.removeTabById）", async () => {
    const handler = new TabCommandHandler()
    await handler.execute({ type: 'tab:remove', tabId: 'tab-1' })

    expect(mocks.closeTab.execute).toHaveBeenCalledTimes(1)
    expect(mocks.closeTab.execute).toHaveBeenCalledWith('tab-1')
  })

  it('tab:remove 不触发 store.removeTabById 旁路（批量关闭曾导致 activeTabId 悬空）', async () => {
    const store = useTabsStore()
    const removeSpy = vi.spyOn(store, 'removeTabById')

    const handler = new TabCommandHandler()
    await handler.execute({ type: 'tab:remove', tabId: 'tab-1' })

    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('tab:close 与 tab:remove 走同一路径', async () => {
    const handler = new TabCommandHandler()
    await handler.execute({ type: 'tab:close', tabId: 'tab-2' })
    await handler.execute({ type: 'tab:remove', tabId: 'tab-3' })

    expect(mocks.closeTab.execute).toHaveBeenNthCalledWith(1, 'tab-2')
    expect(mocks.closeTab.execute).toHaveBeenNthCalledWith(2, 'tab-3')
  })

  it('tab:markDirty 仍直接走 store', async () => {
    const store = useTabsStore()
    const markDirtySpy = vi.spyOn(store, 'markDirty')

    const handler = new TabCommandHandler()
    await handler.execute({ type: 'tab:markDirty', tabId: 'tab-1' })

    expect(markDirtySpy).toHaveBeenCalledWith('tab-1')
    expect(mocks.closeTab.execute).not.toHaveBeenCalled()
  })
})
