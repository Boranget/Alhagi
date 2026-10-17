import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockEventBus } = vi.hoisted(() => ({
  mockEventBus: {
    on: vi.fn().mockReturnValue(vi.fn()),
    off: vi.fn(),
    emit: vi.fn(),
    once: vi.fn(),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    clear: vi.fn(),
    hasListeners: vi.fn().mockReturnValue(false),
    getListenerCount: vi.fn().mockReturnValue(0),
  },
}))

vi.mock('@/events/eventBus', () => ({
  eventBus: mockEventBus,
}))

import { EventBusGateway } from '../EventBusGateway'

describe('EventBusGateway', () => {
  let gateway: EventBusGateway

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = new EventBusGateway()
  })

  it('should delegate on to eventBus', () => {
    const callback = vi.fn()
    gateway.on('app:tab:created', callback)

    expect(mockEventBus.on).toHaveBeenCalledWith('app:tab:created', callback)
  })

  it('should delegate off to eventBus', () => {
    const callback = vi.fn()
    gateway.off('app:tab:closed', callback)

    expect(mockEventBus.off).toHaveBeenCalledWith('app:tab:closed', callback)
  })

  it('should delegate emit to eventBus', () => {
    gateway.emit('app:tab:switched', { tabId: '1', previousTabId: undefined })

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:switched', { tabId: '1', previousTabId: undefined })
  })

  it('should delegate emit without payload', () => {
    gateway.emit('app:editor:ready')

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:editor:ready', undefined)
  })

  it('should delegate once to eventBus', () => {
    const callback = vi.fn()
    gateway.once('app:file:opened', callback)

    expect(mockEventBus.once).toHaveBeenCalledWith('app:file:opened', callback)
  })

  it('should return unsubscribe function from on', () => {
    const unsub = vi.fn()
    mockEventBus.on.mockReturnValue(unsub)

    const result = gateway.on('app:tab:created', vi.fn())

    expect(result).toBe(unsub)
  })

  it('should delegate subscribe to eventBus', () => {
    const subs = { 'app:tab:created': vi.fn() } as unknown as Parameters<typeof gateway.subscribe>[0]
    gateway.subscribe(subs)

    expect(mockEventBus.subscribe).toHaveBeenCalledWith(subs)
  })

  it('should delegate clear to eventBus', () => {
    gateway.clear()
    expect(mockEventBus.clear).toHaveBeenCalled()
  })

  it('should delegate hasListeners to eventBus', () => {
    mockEventBus.hasListeners.mockReturnValue(true)
    expect(gateway.hasListeners('app:tab:created')).toBe(true)
    expect(mockEventBus.hasListeners).toHaveBeenCalledWith('app:tab:created')
  })

  it('should delegate getListenerCount to eventBus', () => {
    mockEventBus.getListenerCount.mockReturnValue(3)
    expect(gateway.getListenerCount('app:tab:created')).toBe(3)
    expect(mockEventBus.getListenerCount).toHaveBeenCalledWith('app:tab:created')
  })
})
