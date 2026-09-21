import type { CommandHandler } from '../types'
import { getDispatcher } from '../dispatcher'
import { eventBus, AppEvents } from '@/events/eventBus'

export function registerEditHandlers(dispatcher: ReturnType<typeof getDispatcher>): void {
  const handlers: Record<string, CommandHandler> = {
    'edit.undo': () => {
      eventBus.emit(AppEvents.EDIT_UNDO)
    },

    'edit.redo': () => {
      eventBus.emit(AppEvents.EDIT_REDO)
    },

    'edit.redoAlt': () => {
      eventBus.emit(AppEvents.EDIT_REDO)
    },

    'edit.cut': () => {
      eventBus.emit(AppEvents.EDITOR_CUT)
    },

    'edit.copy': () => {
      eventBus.emit(AppEvents.EDITOR_COPY)
    },

    'edit.paste': () => {
      eventBus.emit(AppEvents.EDITOR_PASTE)
    },

    'edit.selectAll': () => {
      eventBus.emit(AppEvents.EDITOR_SELECT_ALL)
    },

    'edit.find': () => {
      eventBus.emit(AppEvents.SHOW_SEARCH)
    },

    'edit.replace': () => {
      eventBus.emit(AppEvents.SHOW_SEARCH, { showReplace: true })
    },
  }

  dispatcher.registerBatch(handlers)
}
