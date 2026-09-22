import { describe, it, expect } from 'vitest'
import { TYPES } from '../types'

describe('DI Types', () => {
  it('should define all domain port symbols', () => {
    expect(TYPES.EditorProvider).toBeDefined()
    expect(TYPES.EditorCommands).toBeDefined()
    expect(TYPES.TabRepository).toBeDefined()
    expect(TYPES.LayoutRepository).toBeDefined()
    expect(TYPES.EventBus).toBeDefined()
    expect(TYPES.FileSystem).toBeDefined()
    expect(TYPES.ScrollService).toBeDefined()
    expect(TYPES.ViewModeGateway).toBeDefined()
    expect(TYPES.ElectronSync).toBeDefined()
    expect(TYPES.LayoutSync).toBeDefined()
  })

  it('should define all use case symbols', () => {
    expect(TYPES.CreateTabUseCase).toBeDefined()
    expect(TYPES.CloseTabUseCase).toBeDefined()
    expect(TYPES.SwitchTabUseCase).toBeDefined()
    expect(TYPES.UpdateTabUseCase).toBeDefined()
    expect(TYPES.ExecuteEditorCommandUseCase).toBeDefined()
    expect(TYPES.ToggleTypewriterModeUseCase).toBeDefined()
    expect(TYPES.ToggleFocusModeUseCase).toBeDefined()
  })

  it('should have unique symbols for each binding', () => {
    const allSymbols = Object.values(TYPES)
    const uniqueSymbols = new Set(allSymbols)
    expect(uniqueSymbols.size).toBe(allSymbols.length)
  })
})

describe('DI Container', () => {
  it('should export container and initializeContainer', async () => {
    const mod = await import('../Container')
    expect(mod.container).toBeDefined()
    expect(typeof mod.initializeContainer).toBe('function')
  })
})
