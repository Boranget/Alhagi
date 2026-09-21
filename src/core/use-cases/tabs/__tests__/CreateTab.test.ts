import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateTab } from '../CreateTab'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { IElectronSync } from '@core/domain/ports/gateways/IElectronSync'

describe('CreateTab', () => {
  let createTab: CreateTab
  let mockTabRepository: ITabRepository
  let mockEventBus: IEventBus
  let mockElectronSync: IElectronSync

  beforeEach(() => {
    mockTabRepository = {
      getAll: vi.fn().mockReturnValue([]),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getActiveTab: vi.fn(),
      getActiveTabId: vi.fn().mockReturnValue(null),
      setActiveTab: vi.fn(),
      getDirtyTabs: vi.fn(),
      markDirty: vi.fn(),
      markClean: vi.fn(),
      setViewMode: vi.fn(),
      setSplitRatio: vi.fn(),
      findTabByFilePath: vi.fn(),
      getTabCount: vi.fn(),
      getTabOrder: vi.fn(),
      hasOpenFiles: vi.fn(),
      insert: vi.fn(),
    }

    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      subscribe: vi.fn(),
      clear: vi.fn(),
      hasListeners: vi.fn(),
      getListenerCount: vi.fn(),
    }

    mockElectronSync = { syncOpenedFiles: vi.fn().mockResolvedValue(undefined) } as unknown as IElectronSync

    createTab = new CreateTab(mockTabRepository, mockEventBus, mockElectronSync)
  })

  it('should insert tab into repository and emit events', async () => {
    const result = await createTab.execute({ title: 'Test Tab' })

    expect(mockTabRepository.insert).toHaveBeenCalled()
    expect(mockTabRepository.setActiveTab).toHaveBeenCalled()
    expect(mockEventBus.emit).toHaveBeenCalledWith('app:tab:created', expect.anything())
    expect(result.title).toBe('Test Tab')
  })

  it('should emit FILE_OPENED when filePath is provided', async () => {
    await createTab.execute({ filePath: '/path/to/file.md' })

    expect(mockEventBus.emit).toHaveBeenCalledWith('app:file:opened', expect.objectContaining({ filePath: '/path/to/file.md' }))
  })

  it('should sync opened files with Electron', async () => {
    vi.mocked(mockTabRepository.getAll).mockReturnValue([])

    await createTab.execute({ title: 'Tab' })

    expect(mockElectronSync.syncOpenedFiles).toHaveBeenCalled()
  })
})
