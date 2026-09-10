import { RangeSetBuilder, StateEffect, StateField, type Extension, type EditorState } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import {
  SearchQuery,
  getSearchQuery,
  replaceAll as cmReplaceAll,
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
  create: () => ({ query: null, matches: [], activeIndex: 0 }),
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

function computeMatches(query: SearchQuery, state: EditorState): Match[] {
  const matches: Match[] = []
  const cursor = query.getCursor(state)
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    matches.push({ from: next.value.from, to: next.value.to })
    if (matches.length > 10000) break
  }
  return matches
}

function findNextMatchIndexAfter(matches: Match[], after: number): number {
  const index = matches.findIndex(m => m.from >= after)
  return index === -1 ? 0 : index
}

export class CodeMirrorSearchService implements SearchService {
  private _isReplacing = false

  constructor(private getView: () => EditorView | null) {}

  get isReplacing(): boolean {
    return this._isReplacing
  }

  search(config: SearchConfig, options?: { select?: boolean }): SearchResult {
    const view = this.getView()
    const query = this.createQuery(config)
    if (!view || !query) {
      this.clear()
      return { current: 0, total: 0 }
    }

    const matches = computeMatches(query, view.state)
    if (matches.length === 0) {
      view.dispatch({ effects: [setSearchQuery.of(query), searchHighlightEffect.of({ query, matches: [], activeIndex: 0 })] })
      return { current: 0, total: 0 }
    }

    // Always start from first match (tiptap approach: currentIndex independent of cursor)
    const activeIndex = 0

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

    let nextIndex: number
    if (currentIndex !== -1) {
      nextIndex = currentIndex + 1 >= matches.length ? 0 : currentIndex + 1
    } else {
      nextIndex = field.activeIndex + 1 >= matches.length ? 0 : field.activeIndex + 1
    }

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

    let prevIndex: number
    if (currentIndex !== -1) {
      prevIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1
    } else {
      prevIndex = field.activeIndex <= 0 ? matches.length - 1 : field.activeIndex - 1
    }

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

    const { from } = view.state.selection.main
    const cursor = query.getCursor(view.state, from)
    const next = cursor.next()
    if (next.done) return this.getCurrentResult(view, query)

    const match = next.value
    const replacementText = view.state.toText(query.replace)

    // Compute post-replacement state locally (no dispatch yet)
    const postState = view.state.update({
      changes: { from: match.from, to: match.to, insert: replacementText },
    })

    // Compute matches on the post-replacement state
    const newQuery = new SearchQuery({
      search: query.search,
      caseSensitive: query.caseSensitive,
      wholeWord: query.wholeWord,
      regexp: query.regexp,
      replace: replacement,
    })

    const newMatches = computeMatches(newQuery, postState.state)
    const nextIndex = findNextMatchIndexAfter(newMatches, match.from + replacementText.length)
    const target = newMatches[nextIndex]

    // Suppress CONTENT_CHANGED during replace to prevent double decoration rebuild
    this._isReplacing = true
    try {
      view.dispatch({
        changes: postState.changes,
        selection: target ? { anchor: target.from, head: target.to } : { anchor: match.from + replacementText.length },
        effects: [
          setSearchQuery.of(newQuery),
          searchHighlightEffect.of({ query: newQuery, matches: newMatches, activeIndex: nextIndex }),
        ],
        scrollIntoView: true,
      })
    } finally {
      this._isReplacing = false
    }

    return { current: nextIndex, total: newMatches.length }
  }

  replaceAll(replacement: string): ReplaceResult {
    const view = this.getView()
    if (!view) return { replaced: 0 }

    const query = this.withReplacement(view, replacement)
    if (!query) return { replaced: 0 }

    const matches = computeMatches(query, view.state)
    if (matches.length === 0) return { replaced: 0 }

    // Update CM internal state so cmReplaceAll uses the correct replacement
    view.dispatch({ effects: setSearchQuery.of(query) })
    cmReplaceAll(view)

    // Clear our highlight state (all matches replaced)
    view.dispatch({ effects: searchHighlightEffect.of({ query, matches: [], activeIndex: 0 }) })

    return { replaced: matches.length }
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

    return new SearchQuery({
      search: currentQuery.search,
      caseSensitive: currentQuery.caseSensitive,
      wholeWord: currentQuery.wholeWord,
      regexp: currentQuery.regexp,
      literal: currentQuery.literal,
      replace: replacement,
    })
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
      current: current === -1 ? findNextMatchIndexAfter(matches, mainSel.from) : current,
      total: matches.length,
    }
  }
}
