import { eventBus, AppEvents } from '@/events/eventBus'

export class ToolsCommandHandler {
  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }
    switch (type) {
      case 'tools:preferences':
        eventBus.emit(AppEvents.OPEN_SETTINGS)
        return
      case 'tools:export':
        eventBus.emit(AppEvents.EXPORT, { format: 'markdown' })
        return
      case 'tools:exportHTML':
        eventBus.emit(AppEvents.EXPORT, { format: 'html' })
        return
      case 'tools:exportPDF':
        eventBus.emit(AppEvents.EXPORT, { format: 'pdf' })
        return
      case 'tools:captureScreen':
        eventBus.emit(AppEvents.CAPTURE_SCREEN)
        return
      default:
        throw new Error(`Unknown tools command: ${type}`)
    }
  }
}
