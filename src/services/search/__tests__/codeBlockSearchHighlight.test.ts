import { describe, expect, it, vi } from 'vitest'
import { SearchQuery } from '@codemirror/search'
import type { EditorView } from '@codemirror/view'
import {
  clearAllCodeBlockSearch,
  registerCodeBlock,
  updateAllCodeBlockSearch,
  updateCodeBlockSearchQuery,
} from '../codeBlockSearchHighlight'

function fakeView(dom: HTMLElement): EditorView {
  return { dom, dispatch: vi.fn() } as unknown as EditorView
}

function setup() {
  const ownerA = document.createElement('div')
  const ownerB = document.createElement('div')
  const domA1 = document.createElement('div')
  const domB1 = document.createElement('div')
  ownerA.appendChild(domA1)
  ownerB.appendChild(domB1)
  const viewA = fakeView(domA1)
  const viewB = fakeView(domB1)
  const getPosA = vi.fn(() => 5)
  const getPosB = vi.fn(() => 5)
  registerCodeBlock(getPosA, viewA)
  registerCodeBlock(getPosB, viewB)
  return { ownerA, ownerB, viewA, viewB, getPosA, getPosB }
}

const q = new SearchQuery({ search: 'foo' })

describe('codeBlockSearchHighlight owner 过滤', () => {
  it('updateAllCodeBlockSearch 只分发给 owner 编辑器下的 view', () => {
    const { ownerA, ownerB, viewA, viewB } = setup()
    updateAllCodeBlockSearch(q, ownerA)
    expect(viewA.dispatch).toHaveBeenCalledTimes(1)
    expect(viewB.dispatch).not.toHaveBeenCalled()
    updateAllCodeBlockSearch(q, ownerB)
    expect(viewB.dispatch).toHaveBeenCalledTimes(1)
  })

  it('PM 位置撞号时 active 只落在 owner 的代码块，非 owner 的 getPos 不被求值', () => {
    const { ownerA, viewA, viewB, getPosA, getPosB } = setup()
    updateCodeBlockSearchQuery(q, 5, 0, 3, ownerA)
    expect(getPosA).toHaveBeenCalled()
    expect(getPosB).not.toHaveBeenCalled()
    expect(viewA.dispatch).toHaveBeenCalledTimes(2)
    expect(viewB.dispatch).not.toHaveBeenCalled()
  })

  it('clearAllCodeBlockSearch 仍是全局清除', () => {
    const { ownerA, viewA, viewB } = setup()
    clearAllCodeBlockSearch()
    expect(viewA.dispatch).toHaveBeenCalledTimes(1)
    expect(viewB.dispatch).toHaveBeenCalledTimes(1)
    expect(ownerA.contains(viewA.dom)).toBe(true)
  })
})
