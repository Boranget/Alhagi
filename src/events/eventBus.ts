import type { AppEventName, AppEventPayloads, EventCallback, EventBus } from '@/types'

class EnhancedEventBus implements EventBus {
  private events = new Map<AppEventName, Set<EventCallback>>()

  on<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }
    this.events.get(event)!.add(callback as EventCallback)

    return () => this.off(event, callback)
  }

  off<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.delete(callback as EventCallback)
      
      if (callbacks.size === 0) {
        this.events.delete(event)
      }
    }
  }

  emit<E extends AppEventName>(event: E, payload?: AppEventPayloads[E]): void {
    const callbacks = this.events.get(event)
    if (!callbacks) return

    callbacks.forEach(callback => {
      try {
        callback(payload as unknown)
      } catch (error) {
        console.error(`[EventBus] Error emitting event "${event}":`, error)
      }
    })
  }

  once<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void {
    const wrapper = ((payload: AppEventPayloads[E]) => {
      this.off(event, wrapper)
      callback(payload)
    }) as EventCallback

    this.on(event, wrapper)
  }

  subscribe<E extends AppEventName>(subscriptions: Record<E, EventCallback<AppEventPayloads[E]>>): () => void {
    const unsubscribers: (() => void)[] = []

    Object.entries(subscriptions).forEach(([event, callback]) => {
      unsubscribers.push(this.on(event as E, callback as EventCallback<AppEventPayloads[E]>))
    })

    return () => unsubscribers.forEach(unsubscribe => unsubscribe())
  }

  clear(): void {
    this.events.clear()
  }

  hasListeners(event: AppEventName): boolean {
    return this.events.has(event) && this.events.get(event)!.size > 0
  }

  getListenerCount(event: AppEventName): number {
    return this.events.get(event)?.size ?? 0
  }
}

export const eventBus = new EnhancedEventBus()

export const AppEvents = {
  TAB_CREATED: 'app:tab:created' as const,
  TAB_CLOSED: 'app:tab:closed' as const,
  TAB_SWITCHED: 'app:tab:switched' as const,
  TAB_UPDATED: 'app:tab:updated' as const,
  
  FILE_OPENED: 'app:file:opened' as const,
  FILE_SAVED: 'app:file:saved' as const,
  FOLDER_OPENED: 'app:folder:opened' as const,
  
  EDITOR_READY: 'app:editor:ready' as const,
  EDITOR_DESTROYED: 'app:editor:destroyed' as const,
  VIEW_MODE_CHANGED: 'app:view-mode-changed' as const,
  THEME_CHANGED: 'app:theme:changed' as const,
  
  ACTIVE_EDITOR_CHANGED: 'editor:active-editor-changed' as const,
  CONTENT_CHANGED: 'editor:content:changed' as const,
  CURSOR_CHANGED: 'editor:cursor:changed' as const,
  SELECTION_CHANGED: 'editor:selection:changed' as const,
  SCROLL_CHANGED: 'editor:scroll:changed' as const,
  SCROLL_TO_HEADING: 'editor:scroll-to-heading' as const,
  UNDO: 'editor:undo' as const,
  REDO: 'editor:redo' as const,
  EDIT_UNDO: 'editor:undo' as const,
  EDIT_REDO: 'editor:redo' as const,
  
  COPY_AS_MARKDOWN: 'app:copy-as-markdown' as const,
  COPY_AS_HTML: 'app:copy-as-html' as const,
  PASTE_AS_PLAIN: 'app:paste-as-plain' as const,
  CAPTURE_SCREEN: 'app:capture-screen' as const,
  
  WINDOW_RESIZED: 'app:window:resized' as const,
  WINDOW_MAXIMIZED: 'app:window:maximized' as const,
  WINDOW_MINIMIZED: 'app:window:minimized' as const,
  PREFERENCES_UPDATED: 'app:preferences:updated' as const,
  OPEN_SETTINGS: 'app:open-settings' as const,
  SIDEBAR_VIEW_CHANGED: 'app:sidebar:view-changed' as const,
  
  VIEW_MODE_CHANGE: 'app:view-mode-change' as const,
  TOGGLE_STICKY_NOTE_MODE: 'app:toggle-sticky-note-mode' as const,
  TOGGLE_IMMERSIVE_MODE: 'app:toggle-immersive-mode' as const,
  
  NEW_WINDOW_REQUESTED: 'app:new-window-requested' as const,
  TAB_MERGE_REQUESTED: 'app:tab-merge-requested' as const,
  TAB_DETACHED: 'app:tab-detached' as const,
  FOCUS_TAB_FOR_FILE: 'app:focus-tab-for-file' as const,
}

export type { AppEventName, AppEventPayloads, EventCallback }

export function useEventBus() {
  return {
    on: eventBus.on.bind(eventBus),
    off: eventBus.off.bind(eventBus),
    emit: eventBus.emit.bind(eventBus),
    once: eventBus.once.bind(eventBus),
    subscribe: eventBus.subscribe.bind(eventBus),
    hasListeners: eventBus.hasListeners.bind(eventBus),
    getListenerCount: eventBus.getListenerCount.bind(eventBus),
  }
}