import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateFile } from '../CreateFile'
import type { IFileSystem } from '@core/domain/ports/gateways/IFileSystem'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'

describe('CreateFile', () => {
  let createFile: CreateFile
  let mockFileSystem: IFileSystem
  let mockEventBus: IEventBus

  beforeEach(() => {
    mockFileSystem = {
      readFile: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
      delete: vi.fn(),
      readdir: vi.fn(),
      mkdir: vi.fn(),
      readBinary: vi.fn(),
      writeBinary: vi.fn(),
      existsBatch: vi.fn(),
      stat: vi.fn(),
      rename: vi.fn(),
      copy: vi.fn(),
      move: vi.fn(),
      ensureDirectory: vi.fn(),
      showInFolder: vi.fn(),
      getDocumentsDirectory: vi.fn(),
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
    createFile = new CreateFile(mockFileSystem, mockEventBus)
  })

  it('should create a file and return path', async () => {
    const result = await createFile.execute('/docs', 'readme.md')

    expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/docs/readme.md', '')
    expect(result).toBe('/docs/readme.md')
  })

  it('should return null on error', async () => {
    vi.mocked(mockFileSystem.writeFile).mockRejectedValue(new Error('Permission denied'))

    const result = await createFile.execute('/docs', 'readme.md')

    expect(result).toBeNull()
  })
})
