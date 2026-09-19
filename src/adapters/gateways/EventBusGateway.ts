import type { IEventBus, EventCallback } from '@core/domain/ports/gateways/IEventBus'
import type { AppEventPayloads, AppEventName } from '@shared/types'
import { eventBus } from '@/events/eventBus'

export class EventBusGateway implements IEventBus {
  on<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): () => void {
    return eventBus.on(event, callback)
  }

  off<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): void {
    eventBus.off(event, callback)
  }

  emit<E extends AppEventName>(event: E, payload?: AppEventPayloads[E]): void {
    eventBus.emit(event, payload)
  }

  once<E extends AppEventName>(event: E, callback: EventCallback<AppEventPayloads[E]>): () => void {
    eventBus.once(event, callback)
    return () => this.off(event, callback)
  }

  subscribe<E extends AppEventName>(subscriptions: Record<E, EventCallback<AppEventPayloads[E]>>): () => void {
    return eventBus.subscribe(subscriptions)
  }

  clear(): void {
    eventBus.clear()
  }

  hasListeners(event: AppEventName): boolean {
    return eventBus.hasListeners(event)
  }

  getListenerCount(event: AppEventName): number {
    return eventBus.getListenerCount(event)
  }
}

let instance: EventBusGateway | null = null

export function useEventBusGateway(): EventBusGateway {
  if (!instance) {
    instance = new EventBusGateway()
  }
  return instance
}
