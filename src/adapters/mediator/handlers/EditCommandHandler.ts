import { eventBus, AppEvents } from '@/events/eventBus'

export class EditCommandHandler {
  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }
    switch (type) {
      case 'edit:undo':
        eventBus.emit(AppEvents.EDIT_UNDO)
        return
      case 'edit:redo':
        eventBus.emit(AppEvents.EDIT_REDO)
        return
      case 'edit:cut':
        eventBus.emit(AppEvents.EDITOR_CUT)
        return
      case 'edit:copy':
        eventBus.emit(AppEvents.EDITOR_COPY)
        return
      case 'edit:paste':
        eventBus.emit(AppEvents.EDITOR_PASTE)
        return
      case 'edit:selectAll':
        eventBus.emit(AppEvents.EDITOR_SELECT_ALL)
        return
      case 'edit:find':
        eventBus.emit(AppEvents.SHOW_SEARCH)
        return
      case 'edit:replace':
        eventBus.emit(AppEvents.SHOW_SEARCH, { showReplace: true })
        return
      default:
        throw new Error(`Unknown edit command: ${type}`)
    }
  }
}
