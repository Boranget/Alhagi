import { InitEditor } from '@core/use-cases/editor/InitEditor'
import { GetMarkdown } from '@core/use-cases/editor/GetMarkdown'
import { SetViewMode } from '@core/use-cases/editor/SetViewMode'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'
import { useTabRepository } from '@adapters/stores/tabs'
import type { ViewMode } from '@shared/types'

export function useEditor() {
  const editorProvider = getEditorServiceGateway()
  const eventBus = useEventBusGateway()
  const tabRepository = useTabRepository()

  const initEditor = new InitEditor(editorProvider, eventBus, tabRepository)
  const getMarkdown = new GetMarkdown(editorProvider)
  const setViewMode = new SetViewMode(editorProvider, eventBus)

  return {
    init: (container: HTMLElement, content: string = '', tabId: string) => initEditor.execute(container, content, tabId),
    destroy: () => editorProvider.destroy(),
    isReady: () => editorProvider.isReady(),
    getMarkdown: () => editorProvider.getMarkdown(),
    setMarkdown: (content: string) => editorProvider.setMarkdown(content),
    getHTML: () => editorProvider.getHTML(),
    setViewMode: (mode: ViewMode) => editorProvider.setViewMode(mode),
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