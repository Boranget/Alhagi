import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncPreferences } from '../SyncPreferences'
import type { IPreferencesRepository } from '@core/domain/ports/repositories/IPreferencesRepository'

function createMockPrefsRepo(): IPreferencesRepository {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    setMany: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
    addRecentFile: vi.fn(),
    addRecentFolder: vi.fn(),
    removeRecentFile: vi.fn(),
    removeRecentFolder: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: vi.fn(),
    toggleLightDark: vi.fn(),
    toggleWordCountDisplayType: vi.fn(),
    applyTheme: vi.fn(),
  }
}

describe('SyncPreferences', () => {
  let syncPreferences: SyncPreferences
  let mockRepo: IPreferencesRepository

  beforeEach(() => {
    mockRepo = createMockPrefsRepo()
    syncPreferences = new SyncPreferences(mockRepo)
  })

  it('should subscribe on start', () => {
    syncPreferences.start()
    expect(mockRepo.subscribe).toHaveBeenCalled()
  })

  it('should unsubscribe on stop', () => {
    const unsubscribe = vi.fn()
    vi.mocked(mockRepo.subscribe).mockReturnValue(unsubscribe)

    syncPreferences.start()
    syncPreferences.stop()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('should be safe to stop without start', () => {
    expect(() => syncPreferences.stop()).not.toThrow()
  })

  it('should be idempotent on start', () => {
    syncPreferences.start()
    syncPreferences.start()
    expect(mockRepo.subscribe).toHaveBeenCalledTimes(2)
  })
})
