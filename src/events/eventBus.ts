import { ref } from 'vue'
import type { AppEventName, AppEventPayloads } from '@/types'

export type EventCallback<T = unknown> = (payload: T) => void

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
          // Silent fail - event callback errors
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
export const AppEvents = {
  // Tab相关事件
  TAB_CREATED: 'app:tab:created' as const,
  TAB_CLOSED: 'app:tab:closed' as const,
  TAB_SWITCHED: 'app:tab:switched' as const,
  TAB_UPDATED: 'app:tab:updated' as const,
  
  // 文件相关事件
  FILE_OPENED: 'app:file:opened' as const,
  FILE_SAVED: 'app:file:saved' as const,
  FOLDER_OPENED: 'app:folder:opened' as const,
  
  // 编辑器相关事件
  EDITOR_READY: 'app:editor:ready' as const,
  EDITOR_DESTROYED: 'app:editor:destroyed' as const,
  VIEW_MODE_CHANGED: 'app:view-mode-changed' as const,
  THEME_CHANGED: 'app:theme:changed' as const,
  
  // 编辑器核心事件
  ACTIVE_EDITOR_CHANGED: 'editor:active-editor-changed' as const,
  CONTENT_CHANGED: 'editor:content:changed' as const,
  CURSOR_CHANGED: 'editor:cursor:changed' as const,
  SELECTION_CHANGED: 'editor:selection:changed' as const,
  SCROLL_CHANGED: 'editor:scroll:changed' as const,
  SCROLL_TO_HEADING: 'editor:scroll-to-heading' as const,
  EDIT_UNDO: 'editor:undo' as const,
  EDIT_REDO: 'editor:redo' as const,
  
  // 编辑操作事件
  COPY_AS_MARKDOWN: 'app:copy-as-markdown' as const,
  COPY_AS_HTML: 'app:copy-as-html' as const,
  PASTE_AS_PLAIN: 'app:paste-as-plain' as const,
  CAPTURE_SCREEN: 'app:capture-screen' as const,
  
  // UI事件
  WINDOW_RESIZED: 'app:window:resized' as const,
  WINDOW_MAXIMIZED: 'app:window:maximized' as const,
  WINDOW_MINIMIZED: 'app:window:minimized' as const,
  PREFERENCES_UPDATED: 'app:preferences:updated' as const,
  OPEN_SETTINGS: 'app:open-settings' as const,
  SIDEBAR_VIEW_CHANGED: 'app:sidebar:view-changed' as const
} as const

export function createEventHook<T = unknown>() {
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
          // Silent fail - event callback errors
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
