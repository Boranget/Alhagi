import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageStorageGateway } from '@adapters/gateways/image/ImageStorageGateway'
import type { IFileSystem } from '@core/interfaces/gateways/IFileSystem'

describe('ImageStorageGateway', () => {
  let gateway: ImageStorageGateway
  let mockFileSystem: IFileSystem

  beforeEach(() => {
    mockFileSystem = {
      readFile: vi.fn(),
      readBinary: vi.fn(),
      writeFile: vi.fn(),
      writeBinary: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      existsBatch: vi.fn(),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn(),
      stat: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
      copy: vi.fn(),
      move: vi.fn(),
      ensureDirectory: vi.fn().mockResolvedValue(undefined),
      showInFolder: vi.fn(),
      getDocumentsDirectory: vi.fn().mockResolvedValue('/Users/user/Documents'),
    }

    gateway = new ImageStorageGateway(mockFileSystem)
  })

  describe('saveImage', () => {
    it('should save image to target directory', async () => {
      const result = await gateway.saveImage(
        'base64data',
        'photo.png',
        'image/png',
        '/docs/images'
      )

      expect(result.success).toBe(true)
      expect(result.filePath).toBe('/docs/images/photo.png')
      expect(result.relativePath).toBe('photo.png')
      expect(mockFileSystem.writeBinary).toHaveBeenCalledWith(
        '/docs/images/photo.png',
        'base64data',
        'image/png'
      )
    })

    it('should handle save failure', async () => {
      vi.mocked(mockFileSystem.writeBinary).mockRejectedValueOnce(new Error('Disk error'))

      const result = await gateway.saveImage(
        'base64data',
        'photo.png',
        'image/png',
        '/docs/images'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Disk error')
    })
  })

  describe('ensureDirectory', () => {
    it('should create directory', async () => {
      await gateway.ensureDirectory('/docs/images')

      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith('/docs/images')
    })
  })

  describe('getRelativePath', () => {
    it('should calculate relative path for subdirectory', async () => {
      const result = await gateway.getRelativePath('/docs', '/docs/images/photo.png')

      expect(result).toBe('./images/photo.png')
    })

    it('should calculate relative path with parent traversal', async () => {
      const result = await gateway.getRelativePath('/docs/notes', '/docs/images/photo.png')

      expect(result).toBe('../images/photo.png')
    })

    it('should handle same directory', async () => {
      const result = await gateway.getRelativePath('/docs', '/docs/photo.png')

      expect(result).toBe('./photo.png')
    })
  })

  describe('getDocumentsDirectory', () => {
    it('should return documents directory', async () => {
      const result = await gateway.getDocumentsDirectory()

      expect(result).toBe('/Users/user/Documents')
      expect(mockFileSystem.getDocumentsDirectory).toHaveBeenCalled()
    })
  })

  describe('getImagePath', () => {
    it('should return full image path', async () => {
      const result = await gateway.getImagePath('photo.png', '/docs/images')

      expect(result).toBe('/docs/images/photo.png')
    })
  })
})
