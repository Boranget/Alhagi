import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageInsertService } from '../ImageInsertService'
import { ImageSource } from '@core/entities/image/ImageSource'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import { ImageStorageGateway } from '@adapters/gateways/image/ImageStorageGateway'
import type { IFileSystem } from '@core/domain/ports/gateways/IFileSystem'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'

describe('ImageInsertService Integration', () => {
  let service: ImageInsertService
  let mockFileSystem: IFileSystem
  let mockContext: ImageInsertContext

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

    const imageStorage = new ImageStorageGateway(mockFileSystem)
    service = new ImageInsertService(imageStorage)

    mockContext = {
      currentFilePath: '/docs/projects/readme.md',
      currentFileDir: '/docs/projects',
      editorInsertImage: vi.fn(),
    }
  })

  describe('Keep Original Mode', () => {
    it('should insert local file without modification', async () => {
      const source = new ImageSource({
        type: 'file',
        data: '/images/local-photo.png',
        fileName: 'local-photo.png',
      })
      const options = new ImageInsertOptions({ mode: 'keep-original' })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(result.imageUrl).toBe('/images/local-photo.png')
      expect(mockContext.editorInsertImage).toHaveBeenCalledWith(
        '/images/local-photo.png',
        'local-photo.png'
      )
      expect(mockFileSystem.writeBinary).not.toHaveBeenCalled()
    })

    it('should insert remote URL without modification', async () => {
      const source = new ImageSource({
        type: 'url',
        data: 'https://example.com/image.png',
        fileName: 'remote-image.png',
      })
      const options = new ImageInsertOptions({ mode: 'keep-original' })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(result.imageUrl).toBe('https://example.com/image.png')
      expect(mockContext.editorInsertImage).toHaveBeenCalledWith(
        'https://example.com/image.png',
        'remote-image.png'
      )
    })

    it('should escape URL when escapeUrl is enabled', async () => {
      const source = new ImageSource({
        type: 'file',
        data: '/images/photo (1).png',
        fileName: 'photo (1).png',
      })
      const options = new ImageInsertOptions({
        mode: 'keep-original',
        escapeUrl: true,
      })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(result.imageUrl).toBe('/images/photo%20%281%29.png')
    })
  })

  describe('Copy Mode', () => {
    it('should copy clipboard image to relative directory', async () => {
      const source = new ImageSource({
        type: 'clipboard',
        data: 'base64data',
        fileName: 'screenshot.png',
        mimeType: 'image/png',
      })
      const options = new ImageInsertOptions({
        mode: 'copy',
        copyPath: './images/',
        preferRelativePath: true,
      })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalled()
      expect(mockFileSystem.writeBinary).toHaveBeenCalled()
      expect(mockContext.editorInsertImage).toHaveBeenCalled()
    })

    it('should expand {filename} variable in path', async () => {
      const source = new ImageSource({
        type: 'clipboard',
        data: 'base64data',
        fileName: 'image.png',
        mimeType: 'image/png',
      })
      const options = new ImageInsertOptions({
        mode: 'copy',
        copyPath: './{filename}.assets/',
      })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalled()
      const ensureDirCall = vi.mocked(mockFileSystem.ensureDirectory).mock.calls[0][0]
      expect(ensureDirCall).toContain('readme.assets')
    })

    it('should expand {date} variable in path', async () => {
      const source = new ImageSource({
        type: 'clipboard',
        data: 'base64data',
        fileName: 'image.png',
        mimeType: 'image/png',
      })
      const options = new ImageInsertOptions({
        mode: 'copy',
        copyPath: './images/{date}/',
      })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      const date = new Date()
      const expectedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalled()
      const ensureDirCall = vi.mocked(mockFileSystem.ensureDirectory).mock.calls[0][0]
      expect(ensureDirCall).toContain(expectedDate)
    })

    it('should handle absolute target path', async () => {
      const source = new ImageSource({
        type: 'clipboard',
        data: 'base64data',
        fileName: 'image.png',
        mimeType: 'image/png',
      })
      const options = new ImageInsertOptions({
        mode: 'copy',
        copyPath: 'D:/custom/images',
      })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith('D:/custom/images')
    })

    it('should fallback to documents directory when no current file', async () => {
      const contextWithoutFile: ImageInsertContext = {
        editorInsertImage: vi.fn(),
      }

      const source = new ImageSource({
        type: 'clipboard',
        data: 'base64data',
        fileName: 'image.png',
        mimeType: 'image/png',
      })
      const options = new ImageInsertOptions({
        mode: 'copy',
        copyPath: './images/',
      })

      const result = await service.insertWith(source, options, contextWithoutFile)

      expect(result.success).toBe(true)
      expect(mockFileSystem.getDocumentsDirectory).toHaveBeenCalled()
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalled()
      const ensureDirCall = vi.mocked(mockFileSystem.ensureDirectory).mock.calls[0][0]
      expect(ensureDirCall).toContain('alhagi')
      expect(ensureDirCall).toContain('images')
    })
  })

  describe('Apply To Source', () => {
    it('should skip local images when applyToLocal is false', async () => {
      const source = new ImageSource({
        type: 'file',
        data: '/images/photo.png',
        fileName: 'photo.png',
      })
      const options = new ImageInsertOptions({
        mode: 'copy',
        applyToLocal: false,
      })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(result.imageUrl).toBe('/images/photo.png')
      expect(mockFileSystem.writeBinary).not.toHaveBeenCalled()
    })

    it('should skip remote images when applyToRemote is false', async () => {
      const source = new ImageSource({
        type: 'url',
        data: 'https://example.com/image.png',
        fileName: 'image.png',
      })
      const options = new ImageInsertOptions({
        mode: 'copy',
        applyToRemote: false,
      })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(result.imageUrl).toBe('https://example.com/image.png')
      expect(mockFileSystem.writeBinary).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should return error for unknown mode', async () => {
      const source = new ImageSource({
        type: 'file',
        data: '/images/photo.png',
        fileName: 'photo.png',
      })
      const options = new ImageInsertOptions({ mode: 'unknown' as never })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown insert mode')
    })

    it('should handle storage failure gracefully', async () => {
      vi.mocked(mockFileSystem.writeBinary).mockRejectedValueOnce(new Error('Disk full'))

      const source = new ImageSource({
        type: 'clipboard',
        data: 'base64data',
        fileName: 'image.png',
        mimeType: 'image/png',
      })
      const options = new ImageInsertOptions({
        mode: 'copy',
        copyPath: './images/',
      })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Disk full')
    })
  })

  describe('Custom Strategy', () => {
    it('should allow registering custom strategy', async () => {
      const customStrategy = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          imageUrl: 'custom://image.png',
        }),
      }
      service.registerStrategy('custom', customStrategy)

      const source = new ImageSource({
        type: 'file',
        data: '/images/photo.png',
        fileName: 'photo.png',
      })
      const options = new ImageInsertOptions({ mode: 'custom' as never })

      const result = await service.insertWith(source, options, mockContext)

      expect(result.success).toBe(true)
      expect(result.imageUrl).toBe('custom://image.png')
      expect(customStrategy.execute).toHaveBeenCalled()
    })
  })
})
