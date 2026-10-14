import { eventBus, AppEvents } from '@/events/eventBus'
import { useExport } from '@/composables/useExport'
import { useTabsStore } from '@/stores/tabs'
import { toast } from '@/composables/useToast'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'

export class ToolsCommandHandler {
  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }
    switch (type) {
      case 'tools:preferences':
        eventBus.emit(AppEvents.OPEN_SETTINGS)
        return
      case 'tools:export': {
        const { exportFile } = useExport()
        const tab = useTabsStore().activeTab
        if (tab) exportFile(getEditorServiceGateway().getMarkdown(tab.id), tab.title, 'md')
        return
      }
      case 'tools:exportHTML': {
        const { exportFile } = useExport()
        const tab = useTabsStore().activeTab
        if (tab) exportFile(getEditorServiceGateway().getMarkdown(tab.id), tab.title, 'html')
        return
      }
      case 'tools:exportPDF':
        toast.warning('PDF 导出暂未支持')
        return
      case 'tools:captureScreen':
        eventBus.emit(AppEvents.CAPTURE_SCREEN)
        return
      default:
        throw new Error(`Unknown tools command: ${type}`)
    }
  }
}
