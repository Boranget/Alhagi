import { describe, it, expect, vi } from 'vitest'
import { KeepOriginalStrategy } from '../strategies/KeepOriginalStrategy'
import { ImageSource } from '@core/entities/image/ImageSource'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/interfaces/services/image/IImageInsertStrategy'

describe('KeepOriginalStrategy', () => {
  const createMockContext = (): ImageInsertContext => ({
    currentFilePath: '/docs/readme.md',
    currentFileDir: '/docs',
    editorInsertImage: vi.fn(),
  })

  it('should insert local file image without modification', async () => {
    const strategy = new KeepOriginalStrategy()
    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = ImageInsertOptions.createDefault()
    const context = createMockContext()

    const result = await strategy.execute(source, options, context)

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe('/images/photo.png')
    expect(context.editorInsertImage).toHaveBeenCalledWith('/images/photo.png', 'photo.png')
  })

  it('should insert remote URL image without modification', async () => {
    const strategy = new KeepOriginalStrategy()
    const source = new ImageSource({
      type: 'url',
      data: 'https://example.com/image.png',
      fileName: 'image.png',
    })
    const options = ImageInsertOptions.createDefault()
    const context = createMockContext()

    const result = await strategy.execute(source, options, context)

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe('https://example.com/image.png')
    expect(context.editorInsertImage).toHaveBeenCalledWith('https://example.com/image.png', 'image.png')
  })

  it('should escape URL when escapeUrl is enabled', async () => {
    const strategy = new KeepOriginalStrategy()
    const source = new ImageSource({
      type: 'file',
      data: '/images/photo (1).png',
      fileName: 'photo (1).png',
    })
    const options = new ImageInsertOptions({
      mode: 'keep-original',
      escapeUrl: true,
    })
    const context = createMockContext()

    const result = await strategy.execute(source, options, context)

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe('/images/photo%20%281%29.png')
  })

  it('should handle error gracefully', async () => {
    const strategy = new KeepOriginalStrategy()
    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = ImageInsertOptions.createDefault()
    const context: ImageInsertContext = {
      editorInsertImage: vi.fn().mockImplementation(() => {
        throw new Error('Insert failed')
      }),
    }

    const result = await strategy.execute(source, options, context)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Insert failed')
  })
})
