import type { ITabRepository, CreateTabOptions, TabUpdates } from '@core/domain/ports/repositories/ITabRepository'
import type { ViewMode, TabState } from '@shared/types'
import { Tab } from '@core/entities/Tab'
import { defineStore } from 'pinia'
import { useTabsStore } from '@/stores/tabs'

/**
 * TabRepository adapter - 代理原始 useTabsStore
 *
 * 架构设计：
 * - 实现 Core 层定义的 ITabRepository 接口
 * - 内部代理原始 Pinia store，保持数据一致性
 * - 将 TabState 转换为 Tab 实体供 Core 层使用
 */
export const useTabRepository = defineStore('tabsRepo', (): ITabRepository => {
  const originalStore = useTabsStore()

  // TabState -> Tab 实体转换
  function toTab(state: TabState): Tab {
    return new Tab({
      id: state.id,
      filePath: state.filePath,
      content: state.content,
      isDirty: state.isDirty,
      title: state.title,
      viewMode: state.viewMode,
      splitRatio: state.splitRatio,
      fileType: state.fileType,
      createdAt: state.createdAt,
      lastModified: state.lastModified,
      lastSaved: state.lastSaved,
      cursor: state.cursor,
      scrollTop: state.scrollTop,
      crepe: state.crepe,
      codeMirror: state.codeMirror,
      viewerState: state.viewerState,
    })
  }

  // Tab 实体 -> TabState 转换
  function toTabState(tab: Tab): TabState {
    return tab.toProps() as TabState
  }

  const getAll = (): Tab[] => {
    return originalStore.getAllTabs().map(toTab)
  }

  const getById = (id: string): Tab | undefined => {
    const state = originalStore.getTab(id)
    return state ? toTab(state) : undefined
  }

  /**
   * create — 委托给 CreateTab Use Case（业务逻辑在 Use Case 层）
   * 注意：此方法被 CreateTab Use Case 间接调用时需避免循环。
   * 实际使用中，UI 层应通过 getCreateTabUseCase() 调用。
   */
  const create = (_options?: CreateTabOptions): Tab => {
    // 此方法保留向后兼容，但新代码应使用 CreateTab Use Case
    // 业务逻辑已迁移到 CreateTab.execute()
    throw new Error('Use CreateTab Use Case instead of tabRepository.create()')
  }

  /**
   * insert — 纯数据插入，由 Use Case 调用
   */
  const insert = (tab: Tab): void => {
    originalStore.addTab(toTabState(tab))
  }

  const update = (id: string, updates: Partial<TabUpdates>): void => {
    originalStore.updateTab(id, updates as Partial<TabState>)
  }

  const deleteTab = (id: string): void => {
    originalStore.removeTabById(id)
  }

  const getActiveTab = (): Tab | undefined => {
    const state = originalStore.activeTab
    return state ? toTab(state) : undefined
  }

  const getActiveTabId = (): string | null => {
    return originalStore.activeTabId
  }

  const setActiveTab = (id: string): void => {
    originalStore.setActiveTabId(id)
  }

  const getDirtyTabs = (): Tab[] => {
    return originalStore.dirtyTabs.map(toTab)
  }

  const markDirty = (id: string): void => {
    originalStore.markDirty(id)
  }

  const markClean = (id: string): void => {
    originalStore.markClean(id)
  }

  const setViewMode = (id: string, mode: ViewMode): void => {
    originalStore.setViewMode(id, mode)
  }

  const setSplitRatio = (_id: string, _ratio: number): void => {
    // 原始 store 未实现此方法，暂不支持
  }

  const findTabByFilePath = (filePath: string): Tab | undefined => {
    const state = originalStore.findTabByFilePath(filePath)
    return state ? toTab(state) : undefined
  }

  const getTabCount = (): number => {
    return originalStore.tabCount
  }

  const getTabOrder = (): string[] => {
    return originalStore.getTabOrder()
  }

  const hasOpenFiles = (): boolean => {
    return originalStore.tabCount > 0
  }

  return {
    getAll,
    getById,
    create,
    insert,
    update,
    delete: deleteTab,
    getActiveTab,
    getActiveTabId,
    setActiveTab,
    getDirtyTabs,
    markDirty,
    markClean,
    setViewMode,
    setSplitRatio,
    findTabByFilePath,
    getTabCount,
    getTabOrder,
    hasOpenFiles,
  }
})
