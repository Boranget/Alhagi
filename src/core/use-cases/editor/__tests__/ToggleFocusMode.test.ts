import { describe, it, expect, vi } from 'vitest'
import { ToggleFocusMode } from '../ToggleFocusMode'
import type { IViewModeGateway } from '@core/domain/ports/gateways/IViewModeGateway'

function createMockViewModeGateway(): IViewModeGateway {
  return {
    enableTypewriterMode: vi.fn(),
    disableTypewriterMode: vi.fn(),
    enableFocusMode: vi.fn(),
    disableFocusMode: vi.fn(),
    disableAll: vi.fn(),
  }
}

describe('ToggleFocusMode', () => {
  describe('applyState(true)', () => {
    it('should enable focus mode', () => {
      const viewModeGateway = createMockViewModeGateway()
      const useCase = new ToggleFocusMode(viewModeGateway)

      useCase.applyState(true)

      expect(viewModeGateway.enableFocusMode).toHaveBeenCalledOnce()
    })
  })

  describe('applyState(false)', () => {
    it('should disable focus mode', () => {
      const viewModeGateway = createMockViewModeGateway()
      const useCase = new ToggleFocusMode(viewModeGateway)

      useCase.applyState(false)

      expect(viewModeGateway.disableFocusMode).toHaveBeenCalledOnce()
    })
  })

  describe('idempotency', () => {
    it('should be idempotent', () => {
      const viewModeGateway = createMockViewModeGateway()
      const useCase = new ToggleFocusMode(viewModeGateway)

      useCase.applyState(true)
      useCase.applyState(true)
      useCase.applyState(false)
      useCase.applyState(false)

      expect(viewModeGateway.enableFocusMode).toHaveBeenCalledTimes(2)
      expect(viewModeGateway.disableFocusMode).toHaveBeenCalledTimes(2)
    })
  })
})
