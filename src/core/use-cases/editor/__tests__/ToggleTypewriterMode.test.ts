import { describe, it, expect, vi } from 'vitest'
import { ToggleTypewriterMode } from '../ToggleTypewriterMode'
import type { IScrollService } from '@core/domain/ports/services/IScrollService'
import type { IViewModeGateway } from '@core/domain/ports/gateways/IViewModeGateway'

function createMockScrollService(): IScrollService {
  return {
    scrollCursorToPosition: vi.fn(() => ({ containerFound: true, cursorResolved: true, scrolledDistance: 100 })),
    getCursorY: vi.fn(() => null),
    startTypewriterMode: vi.fn(),
    stopTypewriterMode: vi.fn(),
  }
}

function createMockViewModeGateway(): IViewModeGateway {
  return {
    enableTypewriterMode: vi.fn(),
    disableTypewriterMode: vi.fn(),
    enableFocusMode: vi.fn(),
    disableFocusMode: vi.fn(),
    disableAll: vi.fn(),
    syncToActiveEditor: vi.fn(),
  }
}

describe('ToggleTypewriterMode', () => {
  describe('applyState(true)', () => {
    it('should enable typewriter mode', () => {
      const scrollService = createMockScrollService()
      const viewModeGateway = createMockViewModeGateway()
      const useCase = new ToggleTypewriterMode(scrollService, viewModeGateway)

      useCase.applyState(true)

      expect(viewModeGateway.enableTypewriterMode).toHaveBeenCalledOnce()
      expect(scrollService.startTypewriterMode).toHaveBeenCalledOnce()
      expect(scrollService.scrollCursorToPosition).toHaveBeenCalledOnce()
    })
  })

  describe('applyState(false)', () => {
    it('should disable typewriter mode', () => {
      const scrollService = createMockScrollService()
      const viewModeGateway = createMockViewModeGateway()
      const useCase = new ToggleTypewriterMode(scrollService, viewModeGateway)

      useCase.applyState(false)

      expect(viewModeGateway.disableTypewriterMode).toHaveBeenCalledOnce()
      expect(scrollService.stopTypewriterMode).toHaveBeenCalledOnce()
    })
  })

  describe('idempotency', () => {
    it('should be idempotent', () => {
      const scrollService = createMockScrollService()
      const viewModeGateway = createMockViewModeGateway()
      const useCase = new ToggleTypewriterMode(scrollService, viewModeGateway)

      useCase.applyState(true)
      useCase.applyState(true)
      useCase.applyState(false)
      useCase.applyState(false)

      expect(viewModeGateway.enableTypewriterMode).toHaveBeenCalledTimes(2)
      expect(viewModeGateway.disableTypewriterMode).toHaveBeenCalledTimes(2)
    })
  })
})
