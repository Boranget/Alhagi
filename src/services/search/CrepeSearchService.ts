import { Plugin, PluginKey, EditorState, Transaction, TextSelection } from '@milkdown/kit/prose/state'
import type { Selection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import { $prose } from '@milkdown/kit/utils'
import { SearchQuery as CMSearchQuery } from '@codemirror/search'
import type { SearchConfig } from '@/utils/search'
import { expandRegexReplacement, isInvalidRegexQuery } from '@/utils/searchReplace'
import type { SearchService, SearchResult, ReplaceResult } from './types'
import { useSearchStore } from '@/stores/search'
import { updateCodeBlockSearchQuery } from './codeBlockSearchHighlight'

interface SearchQuery {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

class SearchCache {
  private cache: {
    [key: string]: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>
  } = {}

  private getKey(query: SearchQuery): string {
    return `${query.search}|${query.caseSensitive}|${query.wholeWord}|${query.regexp}`
  }

  get(query: SearchQuery): Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> | null {
    const key = this.getKey(query)
    return this.cache[key] || null
  }

  set(query: SearchQuery, matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>): void {
    const key = this.getKey(query)
    this.cache[key] = matches
  }

  clear(): void {
    this.cache = {}
  }
}

const searchCache = new SearchCache()
const searchPluginKey = new PluginKey<SearchState>('search-highlight')

interface SearchState {
  query: SearchQuery | null
  decorations: DecorationSet
  currentMatchIndex: number
  totalMatches: number
  matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>
}

function findAllMatches(doc: Node, query: SearchQuery): Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> {
  const matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> = []

  doc.descendants((node: Node, pos: number) => {
    if (node.isText && node.text && query.search) {
      const text = node.text
      let regex: RegExp | null = null

      try {
        if (query.regexp && isInvalidRegexQuery(query.search)) return

        let pattern = query.search
        if (!query.regexp) {
          pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        }

        if (query.wholeWord) {
          pattern = `\\b${pattern}\\b`
        }

        const flags = query.caseSensitive ? 'g' : 'gi'
        regex = new RegExp(pattern, flags)
      } catch {
        return
      }

      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          from: pos + match.index,
          to: pos + match.index + match[0].length,
          match: query.regexp ? match : undefined,
          matchStart: pos,
        })
      }
    }
  })

  return matches
}

function buildDecorationsFromMatches(doc: Node, matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>, sel: Selection): DecorationSet {
  const decorations: Decoration[] = []

  matches.forEach((match) => {
    const isActive = match.from === sel.from && match.to === sel.to
    decorations.push(
      Decoration.inline(match.from, match.to, {
        class: isActive ? 'ProseMirror-active-search-match' : 'ProseMirror-search-match',
      }),
    )
  })

  return DecorationSet.create(doc, decorations)
}

export const searchPlugin = $prose(() => new Plugin<SearchState>({
  key: searchPluginKey,
  props: {
    decorations: (state) => {
      const pluginState = searchPluginKey.getState(state)
      return pluginState?.decorations || DecorationSet.empty
    },
  },
  state: {
    init: (): SearchState => ({
      query: null,
      decorations: DecorationSet.empty,
      currentMatchIndex: 0,
      totalMatches: 0,
      matches: [],
    }),
    apply: (tr: Transaction, value: SearchState, _prevState: EditorState, state: EditorState): SearchState => {
      const newState = { ...value }

      if (tr.docChanged) {
        searchCache.clear()

        if (value.query && value.query.search) {
          const matches = findAllMatches(state.doc, value.query)
          searchCache.set(value.query, matches)

          newState.matches = matches
          newState.totalMatches = matches.length
          newState.currentMatchIndex = 0
          newState.decorations = buildDecorationsFromMatches(state.doc, matches, state.selection)
        } else {
          newState.decorations = DecorationSet.empty
          newState.matches = []
          newState.totalMatches = 0
          newState.currentMatchIndex = 0
        }

        return newState
      }

      newState.decorations = newState.decorations.map(tr.mapping, tr.doc)

      const searchMeta = tr.getMeta(searchPluginKey)
      if (searchMeta) {
        const { type, query } = searchMeta as { type: string; query: SearchQuery }
        if (type === 'set' && query) {
          newState.query = query

          const matches = searchCache.get(query)
          if (matches) {
            newState.matches = matches
            newState.totalMatches = matches.length
            newState.decorations = buildDecorationsFromMatches(state.doc, matches, state.selection)
          } else {
            const newMatches = findAllMatches(state.doc, query)
            searchCache.set(query, newMatches)
            newState.matches = newMatches
            newState.totalMatches = newMatches.length
            newState.decorations = buildDecorationsFromMatches(state.doc, newMatches, state.selection)
          }
          newState.currentMatchIndex = 0
        } else if (type === 'clear') {
          newState.query = null
          newState.decorations = DecorationSet.empty
          newState.currentMatchIndex = 0
          newState.totalMatches = 0
          newState.matches = []
        }
      } else if (tr.selectionSet && newState.query && newState.matches.length > 0) {
        newState.decorations = buildDecorationsFromMatches(state.doc, newState.matches, state.selection)
      }

      return newState
    },
  },
}))

export function getSearchPlugin() {
  return searchPlugin
}

export function getSearchPluginKey() {
  return searchPluginKey
}

/**
 * CrepeSearchService - ProseMirror 编辑器搜索服务
 *
 * 架构说明：
 * - 搜索状态（query、matches）存储在模块级变量中，而非实例属性
 * - 这样即使 computed 创建新实例，状态也能保持
 * - 解决了 Vue computed 每次访问可能创建新实例导致状态丢失的问题
 */
export class CrepeSearchService implements SearchService {
  private get store() {
    return useSearchStore()
  }

  constructor(private getView: () => EditorView | null) {}

  search(config: SearchConfig, options?: { select?: boolean }): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    const state = view.state
    const searchQuery: SearchQuery = {
      search: config.search,
      caseSensitive: config.caseSensitive ?? false,
      wholeWord: config.wholeWord ?? false,
      regexp: config.regexp ?? false,
    }

    let matches = searchCache.get(searchQuery)
    if (!matches) {
      matches = findAllMatches(state.doc, searchQuery)
      searchCache.set(searchQuery, matches)
    }

    // 更新模块级状态（与实例解耦）
    this.store.currentQuery = searchQuery
    this.store.currentMatches = matches

    // 更新共享搜索状态，让代码块内的 CodeMirror 也能应用高亮
    const cmSearchQuery = new CMSearchQuery({
      search: searchQuery.search,
      caseSensitive: searchQuery.caseSensitive,
      wholeWord: searchQuery.wholeWord,
      regexp: searchQuery.regexp,
    })

    // 通过 plugin meta 触发高亮装饰
    const tr = state.tr.setMeta(searchPluginKey, { type: 'set', query: searchQuery })

    const sel = state.selection
    let currentMatchIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)
    if (currentMatchIndex === -1 && matches.length > 0) {
      currentMatchIndex = 0
      if (options?.select !== false) {
        const firstMatch = matches[0]
        tr.setSelection(
          new TextSelection(state.doc.resolve(firstMatch.from), state.doc.resolve(firstMatch.to)),
        ).scrollIntoView()
        this.ensureMatchVisible(view, firstMatch.from)
      }
    }

    // 同步 active match 位置到代码块
    const activeMatch = matches[currentMatchIndex]
    updateCodeBlockSearchQuery(
      cmSearchQuery,
      activeMatch?.from ?? -1,
      activeMatch?.to ?? -1,
    )

    this.store.currentIndex = currentMatchIndex
    view.dispatch(tr)

    return {
      current: currentMatchIndex,
      total: matches.length,
    }
  }

  clear(): void {
    this.store.currentQuery = null
    this.store.currentMatches = []
    this.store.currentIndex = -1
    searchCache.clear()

    // 清除共享搜索状态
    updateCodeBlockSearchQuery(null)

    // 通过 plugin meta 清除高亮装饰
    const view = this.getView()
    if (view) {
      const tr = view.state.tr.setMeta(searchPluginKey, { type: 'clear' })
      view.dispatch(tr)
    }
  }

  findNext(): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    // 使用模块级状态（即使创建新实例也能访问）
    if (!this.store.currentQuery || !this.store.currentQuery.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.store.currentMatches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    // 使用 this.store.currentIndex 而非 view.state.selection
    // 因为 ProseMirror dispatch 不是同步更新 view.state 的
    let currentIndex = this.store.currentIndex
    if (currentIndex === -1 || currentIndex >= matches.length) {
      currentIndex = 0
    } else {
      currentIndex = (currentIndex + 1) % matches.length
    }

    const nextMatch = matches[currentIndex]
    const state = view.state
    const tr = state.tr.setSelection(
      new TextSelection(state.doc.resolve(nextMatch.from), state.doc.resolve(nextMatch.to)),
    ).scrollIntoView()
    view.dispatch(tr)

    this.ensureMatchVisible(view, nextMatch.from)

    this.store.currentIndex = currentIndex

    // 同步 active match 到代码块
    if (this.store.currentQuery) {
      const q = this.store.currentQuery
      updateCodeBlockSearchQuery(
        new CMSearchQuery({ search: q.search, caseSensitive: q.caseSensitive, wholeWord: q.wholeWord, regexp: q.regexp }),
        nextMatch.from,
        nextMatch.to,
      )
    }

    return {
      current: currentIndex,
      total: matches.length,
    }
  }

  findPrev(): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    // 使用模块级状态
    if (!this.store.currentQuery || !this.store.currentQuery.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.store.currentMatches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    let currentIndex = this.store.currentIndex
    if (currentIndex === -1 || currentIndex >= matches.length) {
      currentIndex = matches.length - 1
    } else {
      currentIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1
    }

    const prevMatch = matches[currentIndex]
    const state = view.state
    const tr = state.tr.setSelection(
      new TextSelection(state.doc.resolve(prevMatch.from), state.doc.resolve(prevMatch.to)),
    ).scrollIntoView()
    view.dispatch(tr)

    this.ensureMatchVisible(view, prevMatch.from)

    this.store.currentIndex = currentIndex

    // 同步 active match 到代码块
    if (this.store.currentQuery) {
      const q = this.store.currentQuery
      updateCodeBlockSearchQuery(
        new CMSearchQuery({ search: q.search, caseSensitive: q.caseSensitive, wholeWord: q.wholeWord, regexp: q.regexp }),
        prevMatch.from,
        prevMatch.to,
      )
    }

    return {
      current: currentIndex,
      total: matches.length,
    }
  }

  replaceNext(replacement: string): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    // 使用模块级状态
    if (!this.store.currentQuery || !this.store.currentQuery.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.store.currentMatches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    const state = view.state
    const sel = state.selection
    let currentIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)

    if (currentIndex === -1) {
      currentIndex = 0
    }

    const match = matches[currentIndex]
    const replacedText = this.store.currentQuery.regexp && match.match
      ? expandRegexReplacement(replacement, match.match)
      : replacement
    const tr = replacedText === ''
      ? state.tr.delete(match.from, match.to)
      : state.tr.replaceWith(match.from, match.to, state.schema.text(replacedText))

    view.dispatch(tr)

    // 重新计算匹配
    const newState = view.state
    const newMatches = findAllMatches(newState.doc, this.store.currentQuery)
    searchCache.set(this.store.currentQuery, newMatches)
    this.store.currentMatches = newMatches

    const newCurrentIndex = 0
    if (newMatches.length > 0) {
      const selectTr = newState.tr.setSelection(
        new TextSelection(newState.doc.resolve(newMatches[0].from), newState.doc.resolve(newMatches[0].to)),
      ).scrollIntoView()
      view.dispatch(selectTr)
    }

    return {
      current: newCurrentIndex,
      total: newMatches.length,
    }
  }

  replaceAll(replacement: string): ReplaceResult {
    const view = this.getView()
    if (!view) {
      return { replaced: 0 }
    }

    // 使用模块级状态
    if (!this.store.currentQuery || !this.store.currentQuery.search) {
      return { replaced: 0 }
    }

    const matches = this.store.currentMatches
    if (matches.length === 0) {
      return { replaced: 0 }
    }

    const initialState = view.state
    const query = this.store.currentQuery
    let replacedCount = 0

    let tr = initialState.tr

    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]

      if (match.to > initialState.doc.content.size) {
        continue
      }

      const replacedText = query.regexp && match.match
        ? expandRegexReplacement(replacement, match.match)
        : replacement

      tr = replacedText === ''
        ? tr.delete(match.from, match.to)
        : tr.replaceWith(match.from, match.to, initialState.schema.text(replacedText))
      replacedCount++

      if (replacedCount > 10000) {
        break
      }
    }

    if (replacedCount > 0) {
      view.dispatch(tr)
    }

    return { replaced: replacedCount }
  }

  private ensureMatchVisible(view: EditorView, pos: number): void {
    setTimeout(() => {
      try {
        let scrollContainer: HTMLElement | null = null

        scrollContainer = view.dom.closest('.editor-wysiwyg, .editor-split-preview, .milkdown') as HTMLElement

        if (!scrollContainer) {
          scrollContainer = view.dom.closest('[class*="editor"], .milkdown') as HTMLElement
        }

        if (!scrollContainer) return

        let targetElement: HTMLElement | null = null

        const domResult = view.domAtPos(pos)
        if (domResult && domResult.node) {
          if (domResult.node.nodeType === 1) {
            targetElement = domResult.node as HTMLElement
          } else if (domResult.node.nodeType === 3) {
            targetElement = (domResult.node as Text).parentElement
          }
        }

        if (!targetElement) return

        const elementRect = targetElement.getBoundingClientRect()
        const containerRect = scrollContainer.getBoundingClientRect()

        const isVisible = (
          elementRect.top >= containerRect.top &&
          elementRect.bottom <= containerRect.bottom
        )

        if (!isVisible) {
          const scrollTop = scrollContainer.scrollTop
          const relativeTop = elementRect.top - containerRect.top
          const targetScrollTop = scrollTop + relativeTop - 50

          scrollContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          })
        }
      } catch {
        // ignore scroll errors
      }
    }, 50)
  }
}
