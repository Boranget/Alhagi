import { Plugin, PluginKey, EditorState, Transaction, TextSelection } from '@milkdown/kit/prose/state'
import type { Selection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import { $prose } from '@milkdown/kit/utils'
import type { SearchConfig } from '@/utils/search'
import { expandRegexReplacement, isInvalidRegexQuery } from '@/utils/searchReplace'
import type { SearchService, SearchResult, ReplaceResult } from './types'

interface SearchQuery {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

interface SearchState {
  query: SearchQuery | null
  decorations: DecorationSet
  currentMatchIndex: number
  totalMatches: number
  matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>
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

export class CrepeSearchService implements SearchService {
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

    const tr = state.tr.setMeta(searchPluginKey, { type: 'set', query: searchQuery })
    view.dispatch(tr)

    const sel = state.selection
    let currentMatchIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)
    if (currentMatchIndex === -1 && matches.length > 0) {
      currentMatchIndex = 0
      if (options?.select !== false) {
        const firstMatch = matches[0]
        const selectTr = view.state.tr.setSelection(
          new TextSelection(state.doc.resolve(firstMatch.from), state.doc.resolve(firstMatch.to)),
        ).scrollIntoView()
        view.dispatch(selectTr)
        this.ensureMatchVisible(view, firstMatch.from)
      }
    }

    return {
      current: currentMatchIndex,
      total: matches.length,
    }
  }

  clear(): void {
    const view = this.getView()
    if (!view) return

    const tr = view.state.tr.setMeta(searchPluginKey, { type: 'clear' })
    view.dispatch(tr)
  }

  findNext(): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    const state = view.state
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    const matches = pluginState.matches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    const sel = state.selection
    let currentIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)

    if (currentIndex === -1) {
      currentIndex = 0
    } else {
      currentIndex = (currentIndex + 1) % matches.length
    }

    const nextMatch = matches[currentIndex]
    const tr = state.tr.setSelection(
      new TextSelection(state.doc.resolve(nextMatch.from), state.doc.resolve(nextMatch.to)),
    ).scrollIntoView()
    view.dispatch(tr)

    this.ensureMatchVisible(view, nextMatch.from)

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

    const state = view.state
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    const matches = pluginState.matches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    const sel = state.selection
    let currentIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)

    if (currentIndex === -1) {
      currentIndex = matches.length - 1
    } else {
      currentIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1
    }

    const prevMatch = matches[currentIndex]
    const tr = state.tr.setSelection(
      new TextSelection(state.doc.resolve(prevMatch.from), state.doc.resolve(prevMatch.to)),
    ).scrollIntoView()
    view.dispatch(tr)

    this.ensureMatchVisible(view, prevMatch.from)

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

    const state = view.state
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    const matches = pluginState.matches
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    const sel = state.selection
    let currentIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)

    if (currentIndex === -1) {
      currentIndex = 0
    }

    const match = matches[currentIndex]
    const replacedText = pluginState.query.regexp && match.match
      ? expandRegexReplacement(replacement, match.match)
      : replacement
    const tr = replacedText === ''
      ? state.tr.delete(match.from, match.to)
      : state.tr.replaceWith(match.from, match.to, state.schema.text(replacedText))

    view.dispatch(tr)

    const newState = view.state
    const newMatches = findAllMatches(newState.doc, pluginState.query)
    searchCache.set(pluginState.query, newMatches)

    const updateTr = newState.tr.setMeta(searchPluginKey, { type: 'set', query: pluginState.query })
    view.dispatch(updateTr)

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

    const pluginState = searchPluginKey.getState(view.state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { replaced: 0 }
    }

    const matches = pluginState.matches
    if (matches.length === 0) {
      return { replaced: 0 }
    }

    const initialState = view.state
    const query = pluginState.query
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
