import { GetMarkdown } from '@core/use-cases/editor/GetMarkdown'
import { SetViewMode } from '@core/use-cases/editor/SetViewMode'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'
import type { ViewMode } from '@shared/types'
import type { SearchService } from '@/services/search/types'

export function useEditor() {
  const editorProvider = getEditorServiceGateway()
  const eventBus = useEventBusGateway()

  const getMarkdown = new GetMarkdown(editorProvider)
  const setViewMode = new SetViewMode(editorProvider, eventBus)

  return {
    // 新的多实例 API
    initWrapper: (wrapper: HTMLElement) => editorProvider.initWrapper(wrapper),
    detach: () => editorProvider.detach(),
    createTab: (tabId: string, content: string, viewMode?: ViewMode) => editorProvider.createTab(tabId, content, viewMode),
    destroyTab: (tabId: string) => editorProvider.destroyTab(tabId),
    switchTab: (tabId: string) => editorProvider.switchTab(tabId),
    hasTab: (tabId: string) => editorProvider.hasTab(tabId),

    // 搜索
    getCMSearchService: (tabId?: string): SearchService | null => editorProvider.getCMSearchService(tabId),

    // 主题
    updateTheme: (isDark: boolean) => editorProvider.updateTheme(isDark),

    // 通用操作
    destroy: () => editorProvider.destroy(),
    isReady: () => editorProvider.isReady(),
    getMarkdown: () => editorProvider.getMarkdown(),
    getHTML: () => editorProvider.getHTML(),
    setViewMode: (mode: ViewMode) => editorProvider.setViewMode(mode),
    setTabViewMode: (tabId: string, mode: ViewMode) => editorProvider.setTabViewMode(tabId, mode),
    getViewMode: () => editorProvider.getViewMode(),
    onCursorChange: (handler: (from: number, to: number) => void) => editorProvider.onCursorChange(handler),
    onContentChange: (handler: (markdown: string) => void) => editorProvider.onContentChange(handler),
    getHeadings: () => editorProvider.getHeadings(),
    scrollToHeading: (pos: number) => editorProvider.scrollToHeading(pos),
    getCachedContent: (tabId: string) => editorProvider.getCachedContent(tabId),
    setCachedContent: (tabId: string, content: string) => editorProvider.setCachedContent(tabId, content),
    clearCache: () => editorProvider.clearCache(),
    getActiveEditor: () => editorProvider.getActiveEditor(),
    getSelection: () => editorProvider.getSelection(),
    getView: () => editorProvider.getView(),
  }
}
