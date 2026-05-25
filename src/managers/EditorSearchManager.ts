import { editorViewCtx } from '@milkdown/kit/core'
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey, EditorState, Transaction, TextSelection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'

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
}

interface SearchResult {
  current: number
  total: number
}

const searchPluginKey = new PluginKey<SearchState>('search-highlight')

function buildSearchDecorations(state: EditorState, query: SearchQuery): { decorations: DecorationSet; total: number } {
  const decorations: Decoration[] = []
  let matchIndex = 0
  
  const doc = state.doc
  const sel = state.selection
  
  doc.descendants((node: Node, pos: number) => {
    if (node.isText && node.text) {
      const text = node.text
      let regex: RegExp | null = null
      
      try {
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
        const from = pos + match.index
        const to = from + match[0].length
        const isActive = from === sel.from && to === sel.to
        decorations.push(
          Decoration.inline(from, to, {
            class: isActive ? 'ProseMirror-active-search-match' : 'ProseMirror-search-match'
          })
        )
        matchIndex++
      }
    }
  })

  return {
    decorations: DecorationSet.create(doc, decorations),
    total: matchIndex
  }
}

const searchPlugin = $prose(() => new Plugin<SearchState>({
  key: searchPluginKey,
  props: {
    decorations: (state) => {
      const pluginState = searchPluginKey.getState(state)
      return pluginState?.decorations || DecorationSet.empty
    }
  },
  state: {
    init: (): SearchState => ({
      query: null,
      decorations: DecorationSet.empty,
      currentMatchIndex: 0,
      totalMatches: 0
    }),
    apply: (tr: Transaction, value: SearchState, _prevState: EditorState, state: EditorState): SearchState => {
      const newState = { ...value }
      
      newState.decorations = newState.decorations.map(tr.mapping, tr.doc)
      
      const searchMeta = tr.getMeta(searchPluginKey)
      if (searchMeta) {
        const { type, query } = searchMeta as { type: string; query: SearchQuery }
        if (type === 'set' && query) {
          newState.query = query
          const { decorations, total } = buildSearchDecorations(state, query)
          newState.decorations = decorations
          newState.totalMatches = total
          newState.currentMatchIndex = 0
        } else if (type === 'clear') {
          newState.query = null
          newState.decorations = DecorationSet.empty
          newState.currentMatchIndex = 0
          newState.totalMatches = 0
        }
      } else if (tr.selectionSet && newState.query) {
        const { decorations, total } = buildSearchDecorations(state, newState.query)
        newState.decorations = decorations
        newState.totalMatches = total
      }
      
      return newState
    }
  }
}))

export function getSearchPlugin() {
  return searchPlugin
}

export function getSearchPluginKey() {
  return searchPluginKey
}

export class EditorSearchManager {
  private editor: any = null

  init(editor: any) {
    this.editor = editor
  }

  private getView(): EditorView | null {
    if (!this.editor) return null
    let view: EditorView | null = null
    this.editor.action((ctx: { get: (key: unknown) => EditorView }) => {
      view = ctx.get(editorViewCtx)
    })
    return view
  }

  private findAllMatches(state: EditorState, query: SearchQuery): Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> {
    const matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> = []
    
    const doc = state.doc
    doc.descendants((node: Node, pos: number) => {
      if (node.isText && node.text && query.search) {
        const text = node.text
        let regex: RegExp | null = null
        
        try {
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
            matchStart: pos
          })
        }
      }
    })
    
    return matches
  }

  search(query: { search: string; caseSensitive?: boolean; wholeWord?: boolean; regexp?: boolean }): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    let totalMatches = 0
    let currentMatchIndex = 0
    const state = view.state
    
    const searchQuery: SearchQuery = {
      search: query.search,
      caseSensitive: query.caseSensitive ?? false,
      wholeWord: query.wholeWord ?? false,
      regexp: query.regexp ?? false,
    }

    const tr = state.tr.setMeta(searchPluginKey, { type: 'set', query: searchQuery })
    view.dispatch(tr)

    const matches = this.findAllMatches(state, searchQuery)
    totalMatches = matches.length
    
    const sel = state.selection
    currentMatchIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)
    if (currentMatchIndex === -1 && matches.length > 0) {
      currentMatchIndex = 0
      const firstMatch = matches[0]
      const selectTr = view.state.tr.setSelection(new TextSelection(state.doc.resolve(firstMatch.from), state.doc.resolve(firstMatch.to))).scrollIntoView()
      view.dispatch(selectTr)
    }

    return {
      current: currentMatchIndex,
      total: totalMatches
    }
  }

  clearSearch(): void {
    const view = this.getView()
    if (!view) return

    this.editor?.action((ctx: { get: (key: unknown) => EditorView }) => {
      const v = ctx.get(editorViewCtx)
      const tr = v.state.tr.setMeta(searchPluginKey, { type: 'clear' })
      v.dispatch(tr)
    })
  }

  findNext(): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    let totalMatches = 0
    let currentMatchIndex = 0
    const state = view.state
    
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.findAllMatches(state, pluginState.query)
    totalMatches = matches.length
    
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
    const tr = state.tr.setSelection(new TextSelection(state.doc.resolve(nextMatch.from), state.doc.resolve(nextMatch.to))).scrollIntoView()
    view.dispatch(tr)
    
    currentMatchIndex = currentIndex

    return {
      current: currentMatchIndex,
      total: totalMatches
    }
  }

  findPrev(): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    let totalMatches = 0
    let currentMatchIndex = 0
    const state = view.state
    
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.findAllMatches(state, pluginState.query)
    totalMatches = matches.length
    
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
    const tr = state.tr.setSelection(new TextSelection(state.doc.resolve(prevMatch.from), state.doc.resolve(prevMatch.to))).scrollIntoView()
    view.dispatch(tr)
    
    currentMatchIndex = currentIndex

    return {
      current: currentMatchIndex,
      total: totalMatches
    }
  }

  replaceNext(replacement: string): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    let totalMatches = 0
    let currentMatchIndex = 0
    const state = view.state
    
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    const matches = this.findAllMatches(state, pluginState.query)
    
    if (matches.length === 0) {
      return { current: 0, total: 0 }
    }

    const sel = state.selection
    let currentIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)
    
    if (currentIndex === -1) {
      currentIndex = 0
    }

    const match = matches[currentIndex]
    let tr
    
    if (pluginState.query.regexp && match.match) {
      let replacedText = replacement
      const regexMatch = match.match
      
      replacedText = replacedText.replace(/\$(\d+|&)/g, (fullMatch, groupId) => {
        if (groupId === '&') {
          return regexMatch[0] || ''
        }
        const groupNum = parseInt(groupId, 10)
        return regexMatch[groupNum] || ''
      })
      
      tr = state.tr.replaceWith(match.from, match.to, state.schema.text(replacedText))
    } else {
      tr = state.tr.replaceWith(match.from, match.to, state.schema.text(replacement))
    }
    
    if (tr) {
      view.dispatch(tr)
    }

    const newMatches = this.findAllMatches(view.state, pluginState.query)
    totalMatches = newMatches.length
    currentMatchIndex = 0
    
    if (newMatches.length > 0) {
      const newTr = view.state.tr.setSelection(new TextSelection(view.state.doc.resolve(newMatches[0].from), view.state.doc.resolve(newMatches[0].to))).scrollIntoView()
      view.dispatch(newTr)
    }

    return {
      current: currentMatchIndex,
      total: totalMatches
    }
  }

  replaceAll(replacement: string): { replaced: number } {
    const view = this.getView()
    if (!view) {
      return { replaced: 0 }
    }

    let replacedCount = 0
    
    const pluginState = searchPluginKey.getState(view.state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { replaced: 0 }
    }

    let state = view.state
    const query = pluginState.query
    
    const matches = this.findAllMatches(state, query)
    
    if (matches.length === 0) {
      return { replaced: 0 }
    }
    
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]
      
      if (match.to > state.doc.content.size) {
        continue
      }
      
      let tr
      
      if (query.regexp && match.match) {
        let replacedText = replacement
        const regexMatch = match.match
        
        replacedText = replacedText.replace(/\$(\d+|&)/g, (fullMatch, groupId) => {
          if (groupId === '&') {
            return regexMatch[0] || ''
          }
          const groupNum = parseInt(groupId, 10)
          return regexMatch[groupNum] || ''
        })
        
        tr = state.tr.replaceWith(match.from, match.to, state.schema.text(replacedText))
      } else {
        tr = state.tr.replaceWith(match.from, match.to, state.schema.text(replacement))
      }
      
      if (tr) {
        view.dispatch(tr)
        replacedCount++
      }
      
      state = view.state
      
      if (replacedCount > 10000) {
        break
      }
    }

    return { replaced: replacedCount }
  }
}

let searchManagerInstance: EditorSearchManager | null = null

export function useEditorSearchManager(): EditorSearchManager {
  if (!searchManagerInstance) {
    searchManagerInstance = new EditorSearchManager()
  }
  return searchManagerInstance
}
