import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import type { ViewMode } from '@shared/types'
import type { SearchService } from '@/services/search/types'

// ============================================================
// useEditorContext — 组件层编辑器门面（唯一入口）
// ============================================================
//
// 直接委托 EditorServiceGateway（IEditorProvider），只暴露组件实际
// 消费的能力。池级事件桥接在组合根（bridgeEditorEvents），组件不再
// 订阅/转发池回调；新增能力按需在此有意添加，不做全量代理。

export function useEditorContext() {
  const gateway = getEditorServiceGateway()

  return {
    initWrapper: (wrapper: HTMLElement) => gateway.initWrapper(wrapper),
    detach: () => gateway.detach(),
    createTab: (tabId: string, content: string, viewMode?: ViewMode) => gateway.createTab(tabId, content, viewMode),
    destroyTab: (tabId: string) => gateway.destroyTab(tabId),
    switchTab: (tabId: string) => gateway.switchTab(tabId),
    hasTab: (tabId: string) => gateway.hasTab(tabId),
    setTabViewMode: (tabId: string, mode: ViewMode) => gateway.setTabViewMode(tabId, mode),
    getCMSearchService: (tabId?: string): SearchService | null => gateway.getCMSearchService(tabId),
    getView: () => gateway.getView(),
  }
}

export type EditorContext = ReturnType<typeof useEditorContext>
