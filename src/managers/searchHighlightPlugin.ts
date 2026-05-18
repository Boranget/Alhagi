import { search, SearchQuery, setSearchState, getSearchState } from 'prosemirror-search'
import { PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'
import type { EditorState, Transaction } from '@milkdown/prose/state'
import type { Node } from '@milkdown/prose/model'
import type { SearchConfig } from '@/utils/search'

export type { SearchConfig } from '@/utils/search'

export interface MatchRange {
  from: number
  to: number
  text: string
}

export const searchPluginKey = new PluginKey('search')

export const searchHighlightPlugin = $prose(() => search({}))

export function createSearchQuery(config: SearchConfig): SearchQuery {
  return new SearchQuery({
    search: config.search,
    caseSensitive: config.caseSensitive,
    wholeWord: config.wholeWord,
    regexp: config.regexp
  })
}

export function setSearchHighlight(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  config: SearchConfig
) {
  const query = createSearchQuery(config)
  const tr = setSearchState(state.tr, query)
  dispatch(tr)
}

export function clearSearchHighlight(
  state: EditorState,
  dispatch: (tr: Transaction) => void
) {
  const tr = setSearchState(state.tr, new SearchQuery({ search: '' }))
  dispatch(tr)
}

export function findMatchesInDocument(doc: Node, config: SearchConfig): MatchRange[] {
  const matches: MatchRange[] = []
  const query = createSearchQuery(config)
  
  if (!query.valid) return matches

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const pattern = buildPattern(config)
      if (pattern) {
        let match: RegExpExecArray | null
        const text = node.text
        while ((match = pattern.exec(text)) !== null) {
          matches.push({
            from: pos + match.index,
            to: pos + match.index + match[0].length,
            text: match[0]
          })
        }
      }
    }
    return true
  })
  
  return matches
}

function buildPattern(config: SearchConfig): RegExp | null {
  if (!config.search) return null
  
  let patternString = config.search
  
  if (!config.regexp) {
    patternString = patternString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  if (config.wholeWord) {
    patternString = `\\b${patternString}\\b`
  }
  
  const flags = config.caseSensitive ? 'g' : 'gi'
  
  try {
    return new RegExp(patternString, flags)
  } catch {
    return null
  }
}

export function getCurrentSearchState(state: EditorState) {
  return getSearchState(state)
}
