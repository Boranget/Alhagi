import { search, SearchQuery, setSearchState, getSearchState } from 'prosemirror-search'
import { PluginKey } from '@milkdown/prose/state'
import type { EditorState } from '@milkdown/prose/state'
import type { Node } from '@milkdown/prose/model'
import type { SearchConfig } from '@/utils/search'

// Export SearchConfig from search utils to maintain compatibility
export type { SearchConfig } from '@/utils/search'

// Create a plugin key to access the search plugin state
export const searchPluginKey = new PluginKey('search')

// Create the search plugin
export const searchHighlightPlugin = () => {
  return search({
    // We'll manage the state externally
  })
}

// Convert our SearchConfig to prosemirror-search's SearchQuery
export function createSearchQuery(config: SearchConfig): SearchQuery {
  return new SearchQuery({
    search: config.search,
    caseSensitive: config.caseSensitive,
    wholeWord: config.wholeWord,
    regexp: config.regexp
  })
}

// Update search state in the editor
export function setSearchHighlight(
  state: EditorState,
  dispatch: (tr: any) => void,
  config: SearchConfig
) {
  const query = createSearchQuery(config)
  const tr = setSearchState(state.tr, query)
  dispatch(tr)
}

// Clear search highlighting
export function clearSearchHighlight(
  state: EditorState,
  dispatch: (tr: any) => void
) {
  const tr = setSearchState(state.tr, new SearchQuery({ search: '' }))
  dispatch(tr)
}

// Find all matches in the document (maintains compatibility)
export function findMatchesInDocument(doc: Node, config: SearchConfig) {
  // This is a simplified version for compatibility
  // prosemirror-search handles this internally through the plugin
  // We still export it for other uses
  const matches: Array<{ from: number; to: number; text: string }> = []
  const query = createSearchQuery(config)
  
  if (!query.valid) return matches

  // Walk the document and find matches manually for compatibility
  // Note: prosemirror-search's plugin will do the actual highlighting
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

// Helper to build regex pattern (maintains compatibility)
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

// Get the current search state
export function getCurrentSearchState(state: EditorState) {
  return getSearchState(state)
}
