import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSearchStore } from '../search'

describe('Search Store（引擎↔UI 共享状态通道）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态为空', () => {
    const store = useSearchStore()
    expect(store.currentQuery).toBeNull()
    expect(store.currentMatches).toEqual([])
    expect(store.currentIndex).toBe(-1)
    expect(store.totalMatches).toBe(0)
  })

  it('引擎侧写入后，读取方经同一引用拿到最新状态', () => {
    const store = useSearchStore()
    store.currentQuery = { search: 'hello', caseSensitive: false, wholeWord: false, regexp: false }
    store.currentMatches = [{ from: 0, to: 5 }]
    store.currentIndex = 2
    store.totalMatches = 5

    expect(store.currentQuery.search).toBe('hello')
    expect(store.currentMatches).toHaveLength(1)
    expect(store.currentIndex).toBe(2)
    expect(store.totalMatches).toBe(5)
  })

  it('清空状态（clear 通道）复位全部字段', () => {
    const store = useSearchStore()
    store.currentQuery = { search: 'x', caseSensitive: false, wholeWord: false, regexp: false }
    store.currentMatches = [{ from: 0, to: 1 }]
    store.currentIndex = 0
    store.totalMatches = 1

    store.currentQuery = null
    store.currentMatches = []
    store.currentIndex = -1
    store.totalMatches = 0

    expect(store.currentQuery).toBeNull()
    expect(store.currentIndex).toBe(-1)
    expect(store.totalMatches).toBe(0)
  })
})
