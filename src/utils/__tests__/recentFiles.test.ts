import { describe, it, expect } from 'vitest'
import { deriveRecentFileTitle, normalizeRecentFiles } from '../recentFiles'
import type { RecentFile } from '@/types'

describe('deriveRecentFileTitle', () => {
  it('取文件名并去掉 .md 扩展名', () => {
    expect(deriveRecentFileTitle('C:\\docs\\笔记.md')).toBe('笔记')
    expect(deriveRecentFileTitle('/home/me/readme.md')).toBe('readme')
  })

  it('非 markdown 保留扩展名', () => {
    expect(deriveRecentFileTitle('C:\\docs\\a.txt')).toBe('a.txt')
  })

  it('空路径返回空串', () => {
    expect(deriveRecentFileTitle('')).toBe('')
  })
})

describe('normalizeRecentFiles', () => {
  const entry = (overrides: Partial<RecentFile>): RecentFile => ({
    filePath: 'C:\\docs\\a.md',
    title: 'a',
    lastOpened: 1,
    pinned: false,
    ...overrides,
  })

  it('全部正确时返回原数组引用（避免无意义回写）', () => {
    const list = [entry({})]
    expect(normalizeRecentFiles(list)).toBe(list)
  })

  it('把 UUID 标题纠正为文件名，并保留 pinned / lastOpened', () => {
    const list = [entry({ title: '47909249-b259-4466-830e-77afa39fb538', pinned: true, lastOpened: 42 })]
    const result = normalizeRecentFiles(list)

    expect(result).not.toBe(list)
    expect(result[0]).toMatchObject({
      filePath: 'C:\\docs\\a.md',
      title: 'a',
      pinned: true,
      lastOpened: 42,
    })
  })

  it('兼容早期 string[] 数据', () => {
    const result = normalizeRecentFiles(['C:\\docs\\legacy.md'])

    expect(result[0]).toMatchObject({
      filePath: 'C:\\docs\\legacy.md',
      title: 'legacy',
      pinned: false,
    })
    expect(typeof result[0].lastOpened).toBe('number')
  })
})
