import { describe, it, expect } from 'vitest'
import { PathTemplate } from '../strategies/PathTemplate'

describe('PathTemplate', () => {
  describe('expand', () => {
    it('should expand {filename} variable', () => {
      const result = PathTemplate.expand('./{filename}/', { fileName: 'readme' })
      expect(result).toBe('./readme/')
    })

    it('should expand {filedir} variable', () => {
      const result = PathTemplate.expand('./{filedir}/', { fileDir: 'docs' })
      expect(result).toBe('./docs/')
    })

    it('should expand {date} variable', () => {
      const date = new Date(2026, 8, 13) // September 13, 2026
      const result = PathTemplate.expand('./{date}/', { date })
      expect(result).toBe('./20260913/')
    })

    it('should expand {time} variable', () => {
      const date = new Date(2026, 8, 13, 14, 30, 25) // 14:30:25
      const result = PathTemplate.expand('./{time}/', { date })
      expect(result).toBe('./143025/')
    })

    it('should expand {datetime} variable', () => {
      const date = new Date(2026, 8, 13, 14, 30, 25) // September 13, 2026 14:30:25
      const result = PathTemplate.expand('./{datetime}/', { date })
      expect(result).toBe('./20260913-143025/')
    })

    it('should expand multiple variables', () => {
      const date = new Date(2026, 8, 13, 14, 30, 25)
      const result = PathTemplate.expand('./{filename}/{date}/', { fileName: 'readme', date })
      expect(result).toBe('./readme/20260913/')
    })

    it('should handle unknown variables', () => {
      const result = PathTemplate.expand('./{unknown}/', {})
      expect(result).toBe('./{unknown}/')
    })

    it('should use current date when no date provided', () => {
      const result = PathTemplate.expand('./{date}/', {})
      const now = new Date()
      const expectedDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      expect(result).toBe(`./${expectedDate}/`)
    })
  })

  describe('getAvailableVariables', () => {
    it('should return all available variables', () => {
      const variables = PathTemplate.getAvailableVariables()
      expect(variables).toEqual(['filename', 'filedir', 'date', 'time', 'datetime'])
    })
  })

  describe('getVariableDescriptions', () => {
    it('should return descriptions for all variables', () => {
      const descriptions = PathTemplate.getVariableDescriptions()
      expect(descriptions).toHaveProperty('filename')
      expect(descriptions).toHaveProperty('filedir')
      expect(descriptions).toHaveProperty('date')
      expect(descriptions).toHaveProperty('time')
      expect(descriptions).toHaveProperty('datetime')
    })
  })

  describe('resolveImageFileName', () => {
    it('should return original filename when no template', () => {
      const result = PathTemplate.resolveImageFileName('image.png')
      expect(result).toBe('image.png')
    })

    it('should expand template and preserve extension', () => {
      const result = PathTemplate.resolveImageFileName('image.png', '{filename}')
      expect(result).toBe('image.png')
    })

    it('should add extension if template does not have one', () => {
      const result = PathTemplate.resolveImageFileName('photo.jpg', './images/{filename}')
      expect(result).toBe('./images/photo.jpg')
    })
  })

  describe('toRelativePath', () => {
    it('should convert to relative path', () => {
      const result = PathTemplate.toRelativePath('/docs/images/photo.png', '/docs')
      expect(result).toBe('./images/photo.png')
    })

    it('should handle Windows paths', () => {
      const result = PathTemplate.toRelativePath('D:\\docs\\images\\photo.png', 'D:\\docs')
      expect(result).toBe('./images/photo.png')
    })
  })
})
