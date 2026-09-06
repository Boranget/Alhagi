import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import {
  SearchQuery,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll as cmReplaceAll,
  replaceNext as cmReplaceNext,
  setSearchQuery,
} from '@codemirror/search'
import type { SearchConfig } from '@/utils/search'
import { isInvalidRegexQuery } from '@/utils/searchReplace'
import type { SearchService, SearchResult, ReplaceResult } from './types'

interface SearchHighlightState {
  query: SearchQuery | null
  decorations: DecorationSet
}

const searchHighlightEffect = StateEffect.define<SearchQuery | null>()

const searchMatchMark = Decoration.mark({ class: 'cm-searchMatch' })
const selectedSearchMatchMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

function buildSearchDecorations(view: EditorView, query: SearchQuery | null): DecorationSet {
  if (!query || !query.valid) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  for (const range of view.visibleRanges) {
    const cursor = query.getCursor(view.state, range.from, range.to)
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      const selected = view.state.selection.ranges.some(selection =>
        selection.from === next.value.from && selection.to === next.value.to,
      )
      builder.add(next.value.from, next.value.to, selected ? selectedSearchMatchMark : searchMatchMark)
    }
  }
  return builder.finish()
}

export const codeMirrorSearchHighlight = (): Extension => {
  const searchHighlightField = StateField.define<SearchHighlightState>({
    create: () => ({ query: null, decorations: Decoration.none }),
    update(value, tr) {
      let nextQuery = value.query
      for (const effect of tr.effects) {
        if (effect.is(searchHighlightEffect)) nextQuery = effect.value
      }
      return {
        query: nextQuery,
        decorations: value.decorations.map(tr.changes),
      }
    },
  })

  const searchHighlightPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet

    constructor(private view: EditorView) {
      this.decorations = buildSearchDecorations(view, view.state.field(searchHighlightField).query)
    }

    update(update: ViewUpdate) {
      const state = update.state.field(searchHighlightField)
      const prevState = update.startState.field(searchHighlightField)
      if (state.query !== prevState.query || update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildSearchDecorations(this.view, state.query)
      }
    }
  }, {
    decorations: plugin => plugin.decorations,
  })

  return [searchHighlightField, searchHighlightPlugin]
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

    view.dispatch({ effects: [setSearchQuery.of(query), searchHighlightEffect.of(query)] })

    const matches = this.getMatches(query, view)
    if (matches.length === 0) return { current: 0, total: 0 }

    const selection = view.state.selection.main
    const current = matches.findIndex(match => match.from === selection.from && match.to === selection.to)
    if (current !== -1) {
      return { current, total: matches.length }
    }

    if (options?.select !== false) {
      this.selectMatch(view, matches[0])
    }
    return { current: 0, total: matches.length }
  }

  clear(): void {
    const view = this.getView()
    if (!view) return

    view.dispatch({ effects: [
      setSearchQuery.of(new SearchQuery({ search: '' })),
      searchHighlightEffect.of(null),
    ] })
  }

  findNext(): SearchResult {
    const view = this.getView()
    if (!view) return { current: 0, total: 0 }

    findNext(view)
    return this.getCurrentResult(view)
  }

  findPrev(): SearchResult {
    const view = this.getView()
    if (!view) return { current: 0, total: 0 }

    findPrevious(view)
    return this.getCurrentResult(view)
  }

  replaceNext(replacement: string): SearchResult {
    const view = this.getView()
    if (!view) return { current: 0, total: 0 }

    const query = this.withReplacement(view, replacement)
    if (!query) return { current: 0, total: 0 }

    cmReplaceNext(view)
    return this.getCurrentResult(view, query)
  }

  replaceAll(replacement: string): ReplaceResult {
    const view = this.getView()
    if (!view) return { replaced: 0 }

    const query = this.withReplacement(view, replacement)
    if (!query) return { replaced: 0 }

    const replaced = this.getMatches(query, view).length
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

    view.dispatch({ effects: [setSearchQuery.of(nextQuery), searchHighlightEffect.of(nextQuery)] })
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

    const matches = this.getMatches(query, view)
    if (matches.length === 0) return { current: 0, total: 0 }

    const selection = view.state.selection.main
    const current = matches.findIndex(match => match.from === selection.from && match.to === selection.to)
    return {
      current: current === -1 ? 0 : current,
      total: matches.length,
    }
  }

  private getMatches(query: SearchQuery, view: EditorView): Array<{ from: number; to: number }> {
    const matches: Array<{ from: number; to: number }> = []
    const cursor = query.getCursor(view.state)

    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      matches.push({ from: next.value.from, to: next.value.to })
      if (matches.length > 10000) break
    }

    return matches
  }

  private selectMatch(view: EditorView, match: { from: number; to: number }): void {
    view.dispatch({
      selection: { anchor: match.from, head: match.to },
      scrollIntoView: true,
    })
  }
}
