import { describe, it, expect } from 'vitest'
import { escapeImageUrl } from '../strategies/escapeImageUrl'

describe('escapeImageUrl', () => {
  it('should escape percent sign', () => {
    expect(escapeImageUrl('100%')).toBe('100%25')
  })

  it('should escape question mark', () => {
    expect(escapeImageUrl('image?v=1')).toBe('image%3Fv=1')
  })

  it('should escape hash', () => {
    expect(escapeImageUrl('image#section')).toBe('image%23section')
  })

  it('should escape square brackets', () => {
    expect(escapeImageUrl('image[1]')).toBe('image%5B1%5D')
  })

  it('should escape at sign', () => {
    expect(escapeImageUrl('user@image')).toBe('user%40image')
  })

  it('should escape exclamation mark', () => {
    expect(escapeImageUrl('image!')).toBe('image%21')
  })

  it('should escape single quote', () => {
    expect(escapeImageUrl("image'")).toBe("image%27")
  })

  it('should escape parentheses', () => {
    expect(escapeImageUrl('image (1)')).toBe('image%20%281%29')
  })

  it('should escape space', () => {
    expect(escapeImageUrl('my image')).toBe('my%20image')
  })

  it('should escape multiple special characters', () => {
    const input = 'image (1).png'
    const expected = 'image%20%281%29.png'
    expect(escapeImageUrl(input)).toBe(expected)
  })

  it('should not modify regular URLs', () => {
    const regularUrl = 'https://example.com/image.png'
    expect(escapeImageUrl(regularUrl)).toBe(regularUrl)
  })

  it('should not modify local file paths', () => {
    const localPath = '/Users/docs/images/photo.png'
    expect(escapeImageUrl(localPath)).toBe(localPath)
  })

  it('should handle empty string', () => {
    expect(escapeImageUrl('')).toBe('')
  })

  it('should handle string with only special characters', () => {
    expect(escapeImageUrl('?!#')).toBe('%3F%21%23')
  })
})
