import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CopyStrategy } from '../strategies/CopyStrategy'
import { ImageSource } from '@core/entities/image/ImageSource'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { IImageStorage } from '@core/interfaces/services/image/IImageStorage'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'

describe('CopyStrategy', () => {
  let strategy: CopyStrategy
  let mockImageStorage: IImageStorage
  let mockContext: ImageInsertContext

  beforeEach(() => {
    mockImageStorage = {
      saveImage: vi.fn().mockResolvedValue({
        success: true,
        filePath: '/docs/images/clipboard-image.png',
        relativePath: 'clipboard-image.png',
      }),
      ensureDirectory: vi.fn().mockResolvedValue(undefined),
      getDocumentsDirectory: vi.fn().mockResolvedValue('/Users/user/Documents'),
    }

    mockContext = {
      currentFilePath: '/docs/readme.md',
      currentFileDir: '/docs',
      editorInsertImage: vi.fn(),
    }

    strategy = new CopyStrategy(mockImageStorage)
  })

  it('should copy clipboard image to target directory', async () => {
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

    const result = await strategy.execute(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(mockImageStorage.ensureDirectory).toHaveBeenCalled()
    expect(mockImageStorage.saveImage).toHaveBeenCalledWith(
      'base64data',
      expect.stringMatching(/^[a-f0-9]{40}\.png$/),
      'image/png',
      expect.stringContaining('images')
    )
    expect(mockContext.editorInsertImage).toHaveBeenCalled()
  })

  it('should expand path template with filename variable', async () => {
    const source = new ImageSource({
      type: 'clipboard',
      data: 'base64data',
      fileName: 'screenshot.png',
      mimeType: 'image/png',
    })
    const options = new ImageInsertOptions({
      mode: 'copy',
      copyPath: './{filename}.assets/',
    })

    const result = await strategy.execute(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(mockImageStorage.ensureDirectory).toHaveBeenCalledWith(
      expect.stringContaining('readme.assets')
    )
  })

  it('should use relative path when preferRelativePath is enabled', async () => {
    const source = new ImageSource({
      type: 'clipboard',
      data: 'base64data',
      fileName: 'image.png',
      mimeType: 'image/png',
    })
    const options = new ImageInsertOptions({
      mode: 'copy',
      copyPath: './images/',
      preferRelativePath: true,
    })

    const result = await strategy.execute(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(mockContext.editorInsertImage).toHaveBeenCalledWith(
      expect.stringContaining('images/'),
      'image.png'
    )
    const insertedUrl = (mockContext.editorInsertImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertedUrl).not.toMatch(/^https?:/)
    expect(insertedUrl).not.toMatch(/^file:/)
  })

  it('should use absolute path when preferRelativePath is disabled', async () => {
    const source = new ImageSource({
      type: 'clipboard',
      data: 'base64data',
      fileName: 'image.png',
      mimeType: 'image/png',
    })
    const options = new ImageInsertOptions({
      mode: 'copy',
      copyPath: './images/',
      preferRelativePath: false,
    })

    const result = await strategy.execute(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(mockContext.editorInsertImage).toHaveBeenCalledWith(
      '/docs/images/clipboard-image.png',
      'image.png'
    )
  })

  it('should escape URL when escapeUrl is enabled', async () => {
    vi.mocked(mockImageStorage.saveImage).mockResolvedValueOnce({
      success: true,
      filePath: '/docs/images/photo (1).png',
      relativePath: 'photo (1).png',
    })

    const source = new ImageSource({
      type: 'clipboard',
      data: 'base64data',
      fileName: 'image.png',
      mimeType: 'image/png',
    })
    const options = new ImageInsertOptions({
      mode: 'copy',
      copyPath: './images/',
      escapeUrl: true,
      preferRelativePath: true,
    })

    const result = await strategy.execute(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(mockContext.editorInsertImage).toHaveBeenCalledWith(
      expect.stringContaining('images/'),
      'image.png'
    )
  })

  it('should handle save failure gracefully', async () => {
    vi.mocked(mockImageStorage.saveImage).mockResolvedValueOnce({
      success: false,
      error: 'Disk full',
    })

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

    const result = await strategy.execute(source, options, mockContext)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Disk full')
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

    const result = await strategy.execute(source, options, mockContext)

    expect(result.success).toBe(true)
    expect(mockImageStorage.ensureDirectory).toHaveBeenCalledWith('D:/custom/images')
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

    const result = await strategy.execute(source, options, contextWithoutFile)

    expect(result.success).toBe(true)
    expect(mockImageStorage.getDocumentsDirectory).toHaveBeenCalled()
    expect(mockImageStorage.ensureDirectory).toHaveBeenCalled()
    const ensureDirCall = vi.mocked(mockImageStorage.ensureDirectory).mock.calls[0][0]
    expect(ensureDirCall).toContain('alhagi')
    expect(ensureDirCall).toContain('images')
  })
})
