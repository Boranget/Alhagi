import { ref } from 'vue'
import type { AppEventName, AppEventPayloads } from '@/types'

export type EventCallback<T = any> = (payload: T) => void

export interface EventBus {
  on<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): () => void
  off<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void
  emit<E extends AppEventName>(event: E, payload?: AppEventPayloads[E]): void
  once<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void
  clear(): void
}

type EventMap = Map<string, Set<EventCallback>>

class SimpleEventBus implements EventBus {
  private events: EventMap = new Map()

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
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(payload)
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error)
        }
      })
    }
  }

  once<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void {
    const wrappedCallback: EventCallback<AppEventPayloads[E]> = (payload) => {
      callback(payload)
      this.off(event, wrappedCallback)
    }
    this.on(event, wrappedCallback)
  }

  clear(): void {
    this.events.clear()
  }
}

export const eventBus = new SimpleEventBus()

// 使用类型安全的事件常量
export const AppEvents: Record<string, AppEventName> = {
  TAB_CREATED: 'app:tab:created',
  TAB_CLOSED: 'app:tab:closed',
  TAB_SWITCHED: 'app:tab:switched',
  TAB_UPDATED: 'app:tab:updated',
  FILE_OPENED: 'app:file:opened',
  FILE_SAVED: 'app:file:saved',
  EDITOR_READY: 'app:editor:ready',
  EDITOR_DESTROYED: 'app:editor:destroyed',
  SIDEBAR_VIEW_CHANGED: 'app:sidebar:view-changed',
  THEME_CHANGED: 'app:theme:changed',
  WINDOW_RESIZED: 'app:window:resized',
  WINDOW_MAXIMIZED: 'app:window:maximized',
  WINDOW_MINIMIZED: 'app:window:minimized',
  PREFERENCES_UPDATED: 'app:preferences:updated',
  CONTENT_CHANGED: 'editor:content:changed',
  CURSOR_CHANGED: 'editor:cursor:changed',
  SELECTION_CHANGED: 'editor:selection:changed',
  SCROLL_CHANGED: 'editor:scroll:changed'
}

export function createEventHook<T = any>() {
  const callbacks = ref<Set<EventCallback<T>>>(new Set())

  return {
    on(callback: EventCallback<T>): () => void {
      callbacks.value.add(callback)
      return () => callbacks.value.delete(callback)
    },
    off(callback: EventCallback<T>): void {
      callbacks.value.delete(callback)
    },
    emit(payload: T): void {
      callbacks.value.forEach(cb => {
        try {
          cb(payload)
        } catch (error) {
          console.error('Event hook error:', error)
        }
      })
    },
    once(callback: EventCallback<T>): void {
      const wrapped: EventCallback<T> = (p) => {
        callback(p)
        callbacks.value.delete(wrapped)
      }
      callbacks.value.add(wrapped)
    }
  }
}
