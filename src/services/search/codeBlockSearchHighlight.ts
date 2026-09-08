import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { SearchQuery } from '@codemirror/search'

interface CodeBlockSearchState {
  query: SearchQuery | null
  decorations: DecorationSet
}

const codeBlockSearchEffect = StateEffect.define<SearchQuery | null>()

const searchMatchMark = Decoration.mark({ class: 'cm-searchMatch' })
const selectedSearchMatchMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

// CSS styles for search matches inside code blocks
const codeBlockSearchTheme = EditorView.baseTheme({
  '&light .cm-searchMatch': { backgroundColor: '#ffff0054' },
  '&dark .cm-searchMatch': { backgroundColor: '#00ffff8a' },
  '&light .cm-searchMatch-selected': { backgroundColor: '#ff6a0054' },
  '&dark .cm-searchMatch-selected': { backgroundColor: '#ff00ff8a' },
})

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

// Module-level state for sharing search query across CodeMirror instances
let currentQuery: SearchQuery | null = null
const listeners = new Set<(query: SearchQuery | null) => void>()

export function updateCodeBlockSearchQuery(query: SearchQuery | null): void {
  currentQuery = query
  listeners.forEach(fn => fn(query))
}

export function getCurrentCodeBlockQuery(): SearchQuery | null {
  return currentQuery
}

export function onCodeBlockQueryChange(fn: (query: SearchQuery | null) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * CodeMirror extension for search highlighting in code block embedded editors.
 * Listens to the shared search state and applies decorations.
 */
export function codeBlockSearchHighlight(): Extension {
  const searchHighlightField = StateField.define<CodeBlockSearchState>({
    create: () => ({ query: null, decorations: Decoration.none }),
    update(value, tr) {
      let nextQuery = value.query
      for (const effect of tr.effects) {
        if (effect.is(codeBlockSearchEffect)) nextQuery = effect.value
      }
      return {
        query: nextQuery,
        decorations: value.decorations.map(tr.changes),
      }
    },
  })

  const searchHighlightPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    private unsubscribe: (() => void) | null = null

    constructor(private view: EditorView) {
      this.decorations = buildSearchDecorations(view, view.state.field(searchHighlightField).query)

      this.unsubscribe = onCodeBlockQueryChange((query) => {
        this.view.dispatch({
          effects: [codeBlockSearchEffect.of(query)],
        })
      })
    }

    update(update: ViewUpdate) {
      const state = update.state.field(searchHighlightField)
      const prevState = update.startState.field(searchHighlightField)
      if (state.query !== prevState.query || update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildSearchDecorations(this.view, state.query)
      }
    }

    destroy() {
      this.unsubscribe?.()
    }
  }, {
    decorations: plugin => plugin.decorations,
  })

  return [searchHighlightField, searchHighlightPlugin, codeBlockSearchTheme]
}
