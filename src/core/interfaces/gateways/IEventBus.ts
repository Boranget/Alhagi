import type { AppEventPayloads, AppEventName } from '@shared/types'

export type EventCallback<T = unknown> = (payload: T) => void

export interface IEventBus {
  on<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): () => void
  off<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void
  emit<E extends AppEventName>(event: E, payload?: AppEventPayloads[E]): void
  once<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): () => void
  subscribe<E extends AppEventName>(subscriptions: Record<E, EventCallback<AppEventPayloads[E]>>): () => void
  clear(): void
  hasListeners(event: AppEventName): boolean
  getListenerCount(event: AppEventName): number
}
