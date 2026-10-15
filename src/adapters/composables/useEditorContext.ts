import { useEditor } from '@/adapters/composables/useEditor'
import { useEditorStore } from '@/stores/editor'
import type { ViewMode } from '@shared/types'
import type { SearchService } from '@/services/search/types'

export function useEditorContext() {
  const editor = useEditor()
  const editorStore = useEditorStore()

  return {
    initWrapper: (wrapper: HTMLElement) => editor.initWrapper(wrapper),
    detach: () => editor.detach(),
    createTab: (tabId: string, content: string, viewMode?: ViewMode) => editor.createTab(tabId, content, viewMode),
    destroyTab: (tabId: string) => editor.destroyTab(tabId),
    switchTab: (tabId: string) => editor.switchTab(tabId),
    hasTab: (tabId: string) => editor.hasTab(tabId),
    getCMSearchService: (tabId?: string): SearchService | null => editor.getCMSearchService(tabId),
    updateTheme: (isDark: boolean) => editor.updateTheme(isDark),
    destroy: () => editor.destroy(),
    isReady: () => editor.isReady(),
    getMarkdown: () => editor.getMarkdown(),
    getHTML: () => editor.getHTML(),
    setViewMode: (mode: ViewMode) => editor.setViewMode(mode),
    setTabViewMode: (tabId: string, mode: ViewMode) => editor.setTabViewMode(tabId, mode),
    getViewMode: () => editor.getViewMode(),
    getActiveEditor: () => editor.getActiveEditor(),
    onCursorChange: (handler: (from: number, to: number) => void) => editor.onCursorChange(handler),
    onContentChange: (handler: (markdown: string) => void) => editor.onContentChange(handler),
    getHeadingsWithPos: () => editorStore.getHeadingsWithPos(),
    scrollToHeading: (pos: number) => editorStore.scrollToHeading(pos),
    getCachedContent: (tabId: string) => editor.getCachedContent(tabId),
    setCachedContent: (tabId: string, content: string) => editor.setCachedContent(tabId, content),
    clearCache: () => editor.clearCache(),
    getView: () => editor.getView(),
  }
}

export type EditorContext = ReturnType<typeof useEditorContext>
