import { describe, it, expect } from 'vitest'
import { resolveHistorySide } from '../historySide'

describe('resolveHistorySide', () => {
  it('source 模式固定走 CM，忽略焦点（PM 不可见）', () => {
    expect(
      resolveHistorySide({ viewMode: 'source', activeInCM: false, activeInCrepe: true, lastFocused: 'crepe' })
    ).toBe('cm')
  })

  it('wysiwyg 模式固定走 Crepe，忽略焦点（CM 不可见）', () => {
    expect(
      resolveHistorySide({ viewMode: 'wysiwyg', activeInCM: true, activeInCrepe: false, lastFocused: 'cm' })
    ).toBe('crepe')
  })

  it('split 模式按当前焦点分派到 CM 侧', () => {
    expect(
      resolveHistorySide({ viewMode: 'split', activeInCM: true, activeInCrepe: false, lastFocused: 'crepe' })
    ).toBe('cm')
  })

  it('split 模式按当前焦点分派到 Crepe 侧', () => {
    expect(
      resolveHistorySide({ viewMode: 'split', activeInCM: false, activeInCrepe: true, lastFocused: 'cm' })
    ).toBe('crepe')
  })

  it('split 模式焦点被菜单夺走时退回最后聚焦侧', () => {
    expect(
      resolveHistorySide({ viewMode: 'split', activeInCM: false, activeInCrepe: false, lastFocused: 'cm' })
    ).toBe('cm')
  })

  it('split 模式无任何焦点记录时默认 Crepe 侧', () => {
    expect(
      resolveHistorySide({ viewMode: 'split', activeInCM: false, activeInCrepe: false, lastFocused: null })
    ).toBe('crepe')
  })
})
