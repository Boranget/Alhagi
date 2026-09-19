import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageInsertService } from '../ImageInsertService'
import { ImageSource } from '@core/entities/image/ImageSource'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { IImageStorage } from '@core/domain/ports/services/image/IImageStorage'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'

describe('ImageInsertService', () => {
  let service: ImageInsertService
  let mockImageStorage: IImageStorage
  let mockContext: ImageInsertContext

  beforeEach(() => {
    mockImageStorage = {
      saveImage: vi.fn().mockResolvedValue({ success: true, filePath: '/docs/images/photo.png' }),
      ensureDirectory: vi.fn().mockResolvedValue(undefined),
      getDocumentsDirectory: vi.fn().mockResolvedValue('/Users/user/Documents'),
    }

    mockContext = {
      currentFilePath: '/docs/readme.md',
      currentFileDir: '/docs',
      editorInsertImage: vi.fn(),
    }

    service = new ImageInsertService(mockImageStorage)
  })

  it('should have default strategies', () => {
    const modes = service.getAvailableModes()
    expect(modes).toContain('keep-original')
    expect(modes).toContain('copy')
  })

  it('should insert with keep-original mode', async () => {
    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = new ImageInsertOptions({ mode: 'keep-original' })

    const result = await service.insertWith(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe('/images/photo.png')
    expect(mockContext.editorInsertImage).toHaveBeenCalled()
  })

  it('should insert with copy mode', async () => {
    const source = new ImageSource({
      type: 'clipboard',
      data: 'base64data',
      fileName: 'clipboard-image.png',
      mimeType: 'image/png',
    })
    const options = new ImageInsertOptions({
      mode: 'copy',
      copyPath: './images/',
    })

    const result = await service.insertWith(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(mockImageStorage.saveImage).toHaveBeenCalled()
    expect(mockContext.editorInsertImage).toHaveBeenCalled()
  })

  it('should return error for unknown mode', async () => {
    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = new ImageInsertOptions({ mode: 'unknown' as any })

    const result = await service.insertWith(source, options, mockContext)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown insert mode')
  })

  it('should skip if shouldApplyToSource returns false', async () => {
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
    expect(mockImageStorage.saveImage).not.toHaveBeenCalled()
  })

  it('should register custom strategy', async () => {
    const customStrategy = {
      execute: vi.fn().mockResolvedValue({ success: true, imageUrl: 'custom' }),
    }
    service.registerStrategy('custom', customStrategy)

    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = new ImageInsertOptions({ mode: 'custom' as any })

    const result = await service.insertWith(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe('custom')
    expect(customStrategy.execute).toHaveBeenCalled()
  })

  it('should fallback clipboard image to copy mode when keep-original is requested', async () => {
    const source = new ImageSource({
      type: 'clipboard',
      data: 'data:image/png;base64,iVBORw0KGgo',
      fileName: 'screenshot.png',
      mimeType: 'image/png',
    })
    const options = new ImageInsertOptions({ mode: 'keep-original' })

    const result = await service.insertWith(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(mockImageStorage.saveImage).toHaveBeenCalled()
    expect(mockContext.editorInsertImage).toHaveBeenCalled()
  })

  it('should not fallback file source to copy mode when keep-original is requested', async () => {
    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = new ImageInsertOptions({ mode: 'keep-original' })

    const result = await service.insertWith(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe('/images/photo.png')
    expect(mockImageStorage.saveImage).not.toHaveBeenCalled()
  })
})
