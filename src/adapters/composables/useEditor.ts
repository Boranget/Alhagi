import { InitEditor } from '@core/use-cases/editor/InitEditor'
import { GetMarkdown } from '@core/use-cases/editor/GetMarkdown'
import { SetViewMode } from '@core/use-cases/editor/SetViewMode'
import { useEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'
import type { ViewMode } from '@shared/types'

export function useEditor() {
  const editorService = useEditorServiceGateway()
  const eventBus = useEventBusGateway()

  const initEditor = new InitEditor(editorService, eventBus)
  const getMarkdown = new GetMarkdown(editorService)
  const setViewMode = new SetViewMode(editorService, eventBus)

  return {
    init: (container: HTMLElement, content: string, tabId: string) => initEditor.execute(container, content, tabId),
    destroy: () => editorService.destroy(),
    isReady: () => editorService.isReady(),
    getMarkdown: () => getMarkdown.execute(),
    setMarkdown: (content: string) => editorService.setMarkdown(content),
    getHTML: () => editorService.getHTML(),
    getView: () => editorService.getView(),
    getCrepe: () => editorService.getCrepe(),
    getCommands: () => editorService.getCommands(),
    setViewMode: (mode: ViewMode) => setViewMode.execute(mode),
    getViewMode: () => editorService.getViewMode(),
    onCursorChange: (handler: (from: number, to: number) => void) => editorService.onCursorChange(handler),
    getHeadingsWithPos: () => editorService.getHeadingsWithPos(),
    scrollToHeading: (text: string, line: number, pos?: number) => editorService.scrollToHeading(text, line, pos),
    getCachedContent: (tabId: string) => editorService.getCachedContent(tabId),
    setCachedContent: (tabId: string, content: string) => editorService.setCachedContent(tabId, content),
    clearCache: () => editorService.clearCache(),
    updateTheme: () => editorService.updateTheme(),
    switchToTab: (tabId: string) => editorService.switchToTab(tabId),
    setActiveEditor: (editor: 'crepe' | 'codemirror' | null) => editorService.setActiveEditor(editor),
    getActiveEditor: () => editorService.getActiveEditor(),
    getCurrentCursorLine: () => editorService.getCurrentCursorLine(),
  }
}
