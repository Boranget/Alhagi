import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdatePreference } from '../UpdatePreference'
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

describe('UpdatePreference', () => {
  let updatePreference: UpdatePreference
  let mockRepo: IPreferencesRepository

  beforeEach(() => {
    mockRepo = createMockPrefsRepo()
    updatePreference = new UpdatePreference(mockRepo)
  })

  it('should set a preference value', async () => {
    await updatePreference.execute('theme', 'dark')
    expect(mockRepo.set).toHaveBeenCalledWith('theme', 'dark')
  })

  it('should set zoom level', async () => {
    await updatePreference.execute('zoom', 1.5)
    expect(mockRepo.set).toHaveBeenCalledWith('zoom', 1.5)
  })
})
