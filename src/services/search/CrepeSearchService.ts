import { Plugin, PluginKey, EditorState, Transaction, TextSelection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import { $prose } from '@milkdown/kit/utils'
import { SearchQuery as CMSearchQuery } from '@codemirror/search'
import type { SearchConfig } from '@/utils/search'
import { expandRegexReplacement, isInvalidRegexQuery } from '@/utils/searchReplace'
import type { SearchService, SearchResult, ReplaceResult } from './types'
import { useSearchStore } from '@/stores/search'
import { updateCodeBlockSearchQuery, clearAllCodeBlockSearch, updateAllCodeBlockSearch } from './codeBlockSearchHighlight'

interface SearchQuery {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

interface MatchInfo {
  from: number
  to: number
  match?: RegExpExecArray
  matchStart?: number
  /** ProseMirror position of the enclosing code_block node (for position conversion) */
  codeBlockPmPos?: number
}

class SearchCache {
  private cache: {
    [key: string]: MatchInfo[]
  } = {}

  private getKey(query: SearchQuery): string {
    return `${query.search}|${query.caseSensitive}|${query.wholeWord}|${query.regexp}`
  }

  get(query: SearchQuery): MatchInfo[] | null {
    const key = this.getKey(query)
    return this.cache[key] || null
  }

  set(query: SearchQuery, matches: MatchInfo[]): void {
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
  activeIndex: number
  totalMatches: number
  matches: MatchInfo[]
}

function findAllMatches(doc: Node, query: SearchQuery): MatchInfo[] {
  const matches: MatchInfo[] = []

  let currentCodeBlockPmPos: number | undefined

  doc.descendants((node: Node, pos: number) => {
    if (node.type.name === 'code_block') {
      currentCodeBlockPmPos = pos
    }

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
          codeBlockPmPos: currentCodeBlockPmPos,
        })
      }
    }
  })

  return matches
}

function buildDecorationsFromMatches(doc: Node, matches: MatchInfo[], activeIndex: number): DecorationSet {
  const decorations: Decoration[] = []

  matches.forEach((match, i) => {
    decorations.push(
      Decoration.inline(match.from, match.to, {
        class: i === activeIndex ? 'ProseMirror-active-search-match' : 'ProseMirror-search-match',
      }),
    )
  })

  return DecorationSet.create(doc, decorations)
}

function findNextIndex(matches: MatchInfo[], from: number): number {
  const idx = matches.findIndex(m => m.from >= from)
  return idx !== -1 ? idx : 0
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
      activeIndex: 0,
      totalMatches: 0,
      matches: [],
    }),
    apply: (tr: Transaction, value: SearchState, _prevState: EditorState, state: EditorState): SearchState => {
      const meta = tr.getMeta(searchPluginKey)

      if (!meta && !tr.docChanged) {
        return value
      }

      const newState = { ...value }

      // --- Path 1: Search query changed (set/clear) ---
      if (meta && (meta as { type: string }).type === 'set' && (meta as { query?: SearchQuery }).query) {
        const { query, activeIndex } = meta as { type: string; query: SearchQuery; activeIndex?: number }
        searchCache.clear()

        const matches = findAllMatches(state.doc, query)
        searchCache.set(query, matches)

        newState.query = query
        newState.matches = matches
        newState.totalMatches = matches.length
        newState.activeIndex = activeIndex ?? 0
        newState.decorations = buildDecorationsFromMatches(state.doc, matches, newState.activeIndex)

        const store = useSearchStore()
        store.currentMatches = matches
        store.totalMatches = matches.length
        store.currentIndex = newState.activeIndex
        return newState
      }

      if (meta && (meta as { type: string }).type === 'clear') {
        newState.query = null
        newState.decorations = DecorationSet.empty
        newState.activeIndex = 0
        newState.totalMatches = 0
        newState.matches = []

        const store = useSearchStore()
        store.currentMatches = []
        store.totalMatches = 0
        store.currentIndex = -1
        return newState
      }

      // --- Path 2: Document changed — tiptap-style mapping ---
      if (tr.docChanged && value.query && value.query.search) {
        searchCache.clear()

        const matches = findAllMatches(state.doc, value.query)
        searchCache.set(value.query, matches)

        newState.matches = matches
        newState.totalMatches = matches.length

        // Map the previous active match's position through the transaction mapping
        let activeIndex = 0
        if (matches.length > 0 && value.activeIndex < value.matches.length) {
          const prevMatch = value.matches[value.activeIndex]
          if (prevMatch) {
            const mappedFrom = tr.mapping.map(prevMatch.from, 1)
            activeIndex = findNextIndex(matches, mappedFrom)
          }
        } else if (matches.length === 0) {
          activeIndex = 0
        }

        newState.activeIndex = activeIndex
        newState.decorations = buildDecorationsFromMatches(state.doc, matches, activeIndex)

        const store = useSearchStore()
        store.currentMatches = matches
        store.totalMatches = matches.length
        store.currentIndex = activeIndex
        return newState
      }

      if (tr.docChanged) {
        newState.decorations = DecorationSet.empty
        newState.matches = []
        newState.totalMatches = 0
        newState.activeIndex = 0

        const store = useSearchStore()
        store.currentMatches = []
        store.totalMatches = 0
        store.currentIndex = -1
        return newState
      }

      // --- Path 3: Non-doc-change transactions ---
      newState.decorations = newState.decorations.map(tr.mapping, tr.doc)

      if (meta) {
        const { type, activeIndex } = meta as { type: string; activeIndex?: number }
        if (type === 'setActive') {
          newState.activeIndex = activeIndex ?? 0
          newState.decorations = buildDecorationsFromMatches(state.doc, newState.matches, newState.activeIndex)
        }
      }

      const store = useSearchStore()
      store.currentIndex = newState.activeIndex

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
 * Architecture follows tiptap's find-and-replace plugin pattern:
 * - activeIndex is managed by the StateField (single source of truth)
 * - Document changes use tr.mapping.map() to track active match position
 * - Navigation (findNext/findPrev) is pure index-based, independent of cursor
 * - replaceNext uses a single dispatch with selection + meta
 */
export class CrepeSearchService implements SearchService {
  private get store() {
    return useSearchStore()
  }

  constructor(private getView: () => EditorView | null) {}

  get isReplacing(): boolean {
    return false
  }

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

    this.store.currentQuery = searchQuery
    this.store.currentMatches = matches

    const cmSearchQuery = new CMSearchQuery({
      search: searchQuery.search,
      caseSensitive: searchQuery.caseSensitive,
      wholeWord: searchQuery.wholeWord,
      regexp: searchQuery.regexp,
    })

    // Determine active index: preserve if query unchanged, else start from 0
    const pluginState = searchPluginKey.getState(state)
    let activeIndex = 0
    if (pluginState?.query
      && pluginState.query.search === searchQuery.search
      && pluginState.query.caseSensitive === searchQuery.caseSensitive
      && pluginState.query.wholeWord === searchQuery.wholeWord
      && pluginState.query.regexp === searchQuery.regexp
      && pluginState.matches.length > 0
      && pluginState.activeIndex < pluginState.matches.length) {
      // Same query — preserve current active index
      activeIndex = pluginState.activeIndex
    } else if (options?.select !== false && matches.length > 0) {
      // New search — start from first match
      activeIndex = 0
    }

    const tr = state.tr.setMeta(searchPluginKey, { type: 'set', query: searchQuery, activeIndex })

    if (matches.length > 0 && options?.select !== false) {
      const firstMatch = matches[activeIndex] ?? matches[0]
      tr.setSelection(
        new TextSelection(state.doc.resolve(firstMatch.from), state.doc.resolve(firstMatch.to)),
      ).scrollIntoView()
      this.ensureMatchVisible(view, firstMatch.from)
    }

    // Sync active match to code blocks
    const activeMatch = matches[activeIndex]
    if (activeMatch && activeMatch.codeBlockPmPos !== undefined) {
      updateCodeBlockSearchQuery(
        cmSearchQuery,
        activeMatch.codeBlockPmPos,
        activeMatch.from,
        activeMatch.to,
      )
    } else {
      updateAllCodeBlockSearch(cmSearchQuery)
    }

    view.dispatch(tr)

    return {
      current: activeIndex,
      total: matches.length,
    }
  }

  clear(): void {
    this.store.currentQuery = null
    this.store.currentMatches = []
    this.store.currentIndex = -1
    searchCache.clear()

    clearAllCodeBlockSearch()

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

    if (!this.store.currentQuery || !this.store.currentQuery.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.store.currentMatches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    // Pure index-based navigation (tiptap style)
    const pluginState = searchPluginKey.getState(view.state)
    let currentIndex = pluginState?.activeIndex ?? this.store.currentIndex
    if (currentIndex === -1 || currentIndex >= matches.length) {
      currentIndex = 0
    } else {
      currentIndex = (currentIndex + 1) % matches.length
    }

    const nextMatch = matches[currentIndex]
    const state = view.state
    const tr = state.tr.setMeta(searchPluginKey, { type: 'setActive', activeIndex: currentIndex }).setSelection(
      new TextSelection(state.doc.resolve(nextMatch.from), state.doc.resolve(nextMatch.to)),
    ).scrollIntoView()
    view.dispatch(tr)

    this.ensureMatchVisible(view, nextMatch.from)

    // Sync to code blocks
    if (this.store.currentQuery) {
      const q = this.store.currentQuery
      if (nextMatch.codeBlockPmPos !== undefined) {
        updateCodeBlockSearchQuery(
          new CMSearchQuery({ search: q.search, caseSensitive: q.caseSensitive, wholeWord: q.wholeWord, regexp: q.regexp }),
          nextMatch.codeBlockPmPos,
          nextMatch.from,
          nextMatch.to,
        )
      } else {
        updateAllCodeBlockSearch(new CMSearchQuery({ search: q.search, caseSensitive: q.caseSensitive, wholeWord: q.wholeWord, regexp: q.regexp }))
      }
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

    if (!this.store.currentQuery || !this.store.currentQuery.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.store.currentMatches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    // Pure index-based navigation (tiptap style)
    const pluginState = searchPluginKey.getState(view.state)
    let currentIndex = pluginState?.activeIndex ?? this.store.currentIndex
    if (currentIndex === -1 || currentIndex >= matches.length) {
      currentIndex = matches.length - 1
    } else {
      currentIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1
    }

    const prevMatch = matches[currentIndex]
    const state = view.state
    const tr = state.tr.setMeta(searchPluginKey, { type: 'setActive', activeIndex: currentIndex }).setSelection(
      new TextSelection(state.doc.resolve(prevMatch.from), state.doc.resolve(prevMatch.to)),
    ).scrollIntoView()
    view.dispatch(tr)

    this.ensureMatchVisible(view, prevMatch.from)

    // Sync to code blocks
    if (this.store.currentQuery) {
      const q = this.store.currentQuery
      if (prevMatch.codeBlockPmPos !== undefined) {
        updateCodeBlockSearchQuery(
          new CMSearchQuery({ search: q.search, caseSensitive: q.caseSensitive, wholeWord: q.wholeWord, regexp: q.regexp }),
          prevMatch.codeBlockPmPos,
          prevMatch.from,
          prevMatch.to,
        )
      } else {
        updateAllCodeBlockSearch(new CMSearchQuery({ search: q.search, caseSensitive: q.caseSensitive, wholeWord: q.wholeWord, regexp: q.regexp }))
      }
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

    if (!this.store.currentQuery || !this.store.currentQuery.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.store.currentMatches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    const state = view.state

    // tiptap style: use activeIndex from plugin state, not cursor position
    const pluginState = searchPluginKey.getState(state)
    let currentIndex = pluginState?.activeIndex ?? this.store.currentIndex
    if (currentIndex === -1 || currentIndex >= matches.length) {
      currentIndex = 0
    }

    const match = matches[currentIndex]
    const replacedText = this.store.currentQuery.regexp && match.match
      ? expandRegexReplacement(replacement, match.match)
      : replacement

    // Single dispatch: replacement + find next match + set selection (tiptap replaceResult pattern)
    const tr = state.tr
    tr.insertText(replacedText, match.from, match.to)

    // Re-search the entire new document state
    const newMatches = findAllMatches(tr.doc, this.store.currentQuery)
    searchCache.set(this.store.currentQuery, newMatches)
    this.store.currentMatches = newMatches

    // Find first match after the replacement text
    let newCurrentIndex = 0
    if (newMatches.length > 0) {
      const afterPos = match.from + replacedText.length
      newCurrentIndex = findNextIndex(newMatches, afterPos)

      const nextMatch = newMatches[newCurrentIndex]
      tr.setSelection(
        new TextSelection(tr.doc.resolve(nextMatch.from), tr.doc.resolve(nextMatch.to)),
      )
      tr.scrollIntoView()
    }

    tr.setMeta(searchPluginKey, { type: 'set', query: this.store.currentQuery, activeIndex: newCurrentIndex })

    // Sync to code blocks
    if (newMatches.length > 0) {
      const nextMatch = newMatches[newCurrentIndex]
      if (this.store.currentQuery && nextMatch.codeBlockPmPos !== undefined) {
        updateCodeBlockSearchQuery(
          new CMSearchQuery({ search: this.store.currentQuery.search, caseSensitive: this.store.currentQuery.caseSensitive, wholeWord: this.store.currentQuery.wholeWord, regexp: this.store.currentQuery.regexp }),
          nextMatch.codeBlockPmPos,
          nextMatch.from,
          nextMatch.to,
        )
      } else if (this.store.currentQuery) {
        updateAllCodeBlockSearch(new CMSearchQuery({ search: this.store.currentQuery.search, caseSensitive: this.store.currentQuery.caseSensitive, wholeWord: this.store.currentQuery.wholeWord, regexp: this.store.currentQuery.regexp }))
      }
    }

    view.dispatch(tr)

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

        let el = view.dom.parentElement as HTMLElement | null
        while (el) {
          const style = window.getComputedStyle(el)
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            scrollContainer = el
            break
          }
          el = el.parentElement
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
