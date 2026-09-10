import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import {
  SearchQuery,
  getSearchQuery,
  replaceAll as cmReplaceAll,
  replaceNext as cmReplaceNext,
  setSearchQuery,
} from '@codemirror/search'
import type { SearchConfig } from '@/utils/search'
import { isInvalidRegexQuery } from '@/utils/searchReplace'
import type { SearchService, SearchResult, ReplaceResult } from './types'

type Match = { from: number; to: number }

interface SearchHighlightState {
  query: SearchQuery | null
  matches: Match[]
  activeIndex: number
  decorations: DecorationSet
}

interface SearchHighlightPayload {
  query: SearchQuery | null
  matches: Match[]
  activeIndex: number
}

const searchHighlightEffect = StateEffect.define<SearchHighlightPayload>()

const searchMatchMark = Decoration.mark({ class: 'cm-searchMatch' })
const selectedSearchMatchMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

const searchHighlightTheme = EditorView.baseTheme({
  '&light .cm-searchMatch': { backgroundColor: '#ffff0054' },
  '&dark .cm-searchMatch': { backgroundColor: '#00ffff8a' },
  '&light .cm-searchMatch-selected': { backgroundColor: '#ff6a0054' },
  '&dark .cm-searchMatch-selected': { backgroundColor: '#ff00ff8a' },
})

function buildSearchDecorations(
  view: EditorView,
  query: SearchQuery | null,
  activeIndex: number,
): DecorationSet {
  if (!query || !query.valid) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  let matchIndex = 0
  for (const range of view.visibleRanges) {
    const cursor = query.getCursor(view.state, range.from, range.to)
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      const isActive = matchIndex === activeIndex
      builder.add(next.value.from, next.value.to, isActive ? selectedSearchMatchMark : searchMatchMark)
      matchIndex++
    }
  }
  return builder.finish()
}

const searchHighlightField = StateField.define<SearchHighlightState>({
  create: () => ({ query: null, matches: [], activeIndex: 0, decorations: Decoration.none }),
  update(value, tr) {
    let nextQuery = value.query
    let nextMatches = value.matches
    let nextActiveIndex = value.activeIndex
    for (const effect of tr.effects) {
      if (effect.is(searchHighlightEffect)) {
        nextQuery = effect.value.query
        nextMatches = effect.value.matches
        nextActiveIndex = effect.value.activeIndex
      }
    }
    return {
      query: nextQuery,
      matches: nextMatches,
      activeIndex: nextActiveIndex,
      decorations: value.decorations.map(tr.changes),
    }
  },
})

export const codeMirrorSearchHighlight = (): Extension => {
  const searchHighlightPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet

    constructor(private view: EditorView) {
      const state = view.state.field(searchHighlightField)
      this.decorations = buildSearchDecorations(this.view, state.query, state.activeIndex)
    }

    update(update: ViewUpdate) {
      const state = update.state.field(searchHighlightField)
      const prevState = update.startState.field(searchHighlightField)
      if (
        state.query !== prevState.query ||
        state.activeIndex !== prevState.activeIndex ||
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet
      ) {
        this.decorations = buildSearchDecorations(this.view, state.query, state.activeIndex)
      }
    }
  }, {
    decorations: plugin => plugin.decorations,
  })

  return [searchHighlightField, searchHighlightPlugin, searchHighlightTheme]
}

function computeMatches(query: SearchQuery, view: EditorView): Match[] {
  const matches: Match[] = []
  const cursor = query.getCursor(view.state)
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    matches.push({ from: next.value.from, to: next.value.to })
    if (matches.length > 10000) break
  }
  return matches
}

export class CodeMirrorSearchService implements SearchService {
  constructor(private getView: () => EditorView | null) {}

  search(config: SearchConfig, options?: { select?: boolean }): SearchResult {
    const view = this.getView()
    const query = this.createQuery(config)
    if (!view || !query) {
      this.clear()
      return { current: 0, total: 0 }
    }

    const matches = computeMatches(query, view)
    if (matches.length === 0) {
      view.dispatch({ effects: [setSearchQuery.of(query), searchHighlightEffect.of({ query, matches: [], activeIndex: 0 })] })
      return { current: 0, total: 0 }
    }

    // Find active match: if cursor is on a match, use that; otherwise use 0
    let activeIndex = 0
    const mainSel = view.state.selection.main
    const found = matches.findIndex(m => m.from === mainSel.from && m.to === mainSel.to)
    if (found !== -1) activeIndex = found

    const dispatch: Parameters<EditorView['dispatch']>[0] = {
      effects: [setSearchQuery.of(query), searchHighlightEffect.of({ query, matches, activeIndex })],
    }

    // select:false: live update — don't move cursor, just update decorations
    // select:true/undefined: initial search / reopen — move cursor to first match
    if (options?.select !== false) {
      dispatch.selection = { anchor: matches[activeIndex].from, head: matches[activeIndex].to }
    }

    view.dispatch(dispatch)

    return { current: activeIndex, total: matches.length }
  }

  clear(): void {
    const view = this.getView()
    if (!view) return

    view.dispatch({ effects: [
      setSearchQuery.of(new SearchQuery({ search: '' })),
      searchHighlightEffect.of({ query: null, matches: [], activeIndex: 0 }),
    ] })
  }

  findNext(): SearchResult {
    const view = this.getView()
    if (!view) return { current: 0, total: 0 }

    const field = view.state.field(searchHighlightField)
    const { matches } = field
    if (matches.length === 0) return { current: 0, total: 0 }

    const mainSel = view.state.selection.main
    const currentIndex = matches.findIndex(m => m.from === mainSel.from && m.to === mainSel.to)
    const nextIndex = currentIndex + 1 >= matches.length ? 0 : currentIndex + 1
    const target = matches[nextIndex]

    view.dispatch({
      selection: { anchor: target.from, head: target.to },
      scrollIntoView: true,
      effects: searchHighlightEffect.of({ query: field.query, matches, activeIndex: nextIndex }),
    })

    return { current: nextIndex, total: matches.length }
  }

  findPrev(): SearchResult {
    const view = this.getView()
    if (!view) return { current: 0, total: 0 }

    const field = view.state.field(searchHighlightField)
    const { matches } = field
    if (matches.length === 0) return { current: 0, total: 0 }

    const mainSel = view.state.selection.main
    const currentIndex = matches.findIndex(m => m.from === mainSel.from && m.to === mainSel.to)
    const prevIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1
    const target = matches[prevIndex]

    view.dispatch({
      selection: { anchor: target.from, head: target.to },
      scrollIntoView: true,
      effects: searchHighlightEffect.of({ query: field.query, matches, activeIndex: prevIndex }),
    })

    return { current: prevIndex, total: matches.length }
  }

  replaceNext(replacement: string): SearchResult {
    const view = this.getView()
    if (!view) return { current: 0, total: 0 }

    const query = this.withReplacement(view, replacement)
    if (!query) return { current: 0, total: 0 }

    cmReplaceNext(view)

    // Compute matches AFTER replace (document changed)
    const newMatches = computeMatches(query, view)

    // cmReplaceNext already moved cursor — find active match
    const mainSel = view.state.selection.main
    const activeIdx = newMatches.findIndex(m => m.from === mainSel.from && m.to === mainSel.to)
    const activeIndex = activeIdx !== -1 ? activeIdx : 0

    view.dispatch({ effects: searchHighlightEffect.of({ query, matches: newMatches, activeIndex }) })

    // cmReplaceNext already moved cursor to next match — just read current position
    return this.getCurrentResult(view, query)
  }

  replaceAll(replacement: string): ReplaceResult {
    const view = this.getView()
    if (!view) return { replaced: 0 }

    const query = this.withReplacement(view, replacement)
    if (!query) return { replaced: 0 }

    const replaced = computeMatches(query, view).length
    if (replaced === 0) return { replaced: 0 }

    cmReplaceAll(view)
    return { replaced }
  }

  private createQuery(config: SearchConfig, replacement = ''): SearchQuery | null {
    if (!config.search.trim()) return null
    if (config.regexp && isInvalidRegexQuery(config.search)) return null

    const query = new SearchQuery({
      search: config.search,
      caseSensitive: config.caseSensitive,
      wholeWord: config.wholeWord,
      regexp: config.regexp,
      replace: replacement,
    })

    return query.valid ? query : null
  }

  private withReplacement(view: EditorView, replacement: string): SearchQuery | null {
    const currentQuery = this.getCurrentQuery(view)
    if (!currentQuery || !currentQuery.valid) return null

    const nextQuery = new SearchQuery({
      search: currentQuery.search,
      caseSensitive: currentQuery.caseSensitive,
      wholeWord: currentQuery.wholeWord,
      regexp: currentQuery.regexp,
      literal: currentQuery.literal,
      replace: replacement,
    })

    const matches = computeMatches(nextQuery, view)
    view.dispatch({ effects: [setSearchQuery.of(nextQuery), searchHighlightEffect.of({ query: nextQuery, matches, activeIndex: 0 })] })
    return nextQuery
  }

  private getCurrentQuery(view: EditorView): SearchQuery | null {
    try {
      return getSearchQuery(view.state)
    } catch {
      return null
    }
  }

  private getCurrentResult(view: EditorView, query = this.getCurrentQuery(view)): SearchResult {
    if (!query || !query.valid) return { current: 0, total: 0 }

    const field = view.state.field(searchHighlightField)
    const { matches } = field
    if (matches.length === 0) return { current: 0, total: 0 }

    const mainSel = view.state.selection.main
    const current = matches.findIndex(m => m.from === mainSel.from && m.to === mainSel.to)
    return {
      current: current === -1 ? 0 : current,
      total: matches.length,
    }
  }
}
