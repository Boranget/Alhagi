import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

export interface SearchConfig {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

const searchHighlightKey = new PluginKey<DecorationSet>('search-highlight')

function createDecorations(doc: any, config: SearchConfig): DecorationSet {
  const decorations: Decoration[] = []

  if (!config.search.trim()) {
    return DecorationSet.empty
  }

  let pattern: RegExp
  try {
    let searchText = config.search

    if (!config.regexp) {
      searchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    if (config.wholeWord) {
      searchText = `\\b${searchText}\\b`
    }

    const flags = config.caseSensitive ? 'g' : 'gi'
    pattern = new RegExp(searchText, flags)
  } catch {
    return DecorationSet.empty
  }

  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      let match: RegExpExecArray | null
      const text = node.text

      while ((match = pattern.exec(text)) !== null) {
        const from = pos + match.index
        const to = from + match[0].length

        decorations.push(
          Decoration.inline(from, to, {
            class: 'search-highlight-match'
          })
        )
      }
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const searchHighlightPlugin = (initialConfig: Partial<SearchConfig> = {}) => {
  const defaultConfig: SearchConfig = {
    search: '',
    caseSensitive: false,
    wholeWord: false,
    regexp: false,
    ...initialConfig
  }

  return new Plugin({
    key: searchHighlightKey,

    state: {
      init(_, { doc }) {
        return createDecorations(doc, defaultConfig)
      },

      apply(tr, oldDecoSet) {
        let newDecoSet = oldDecoSet.map(tr.mapping, tr.doc)

        const searchMeta = tr.getMeta('search')
        if (searchMeta) {
          const config = searchMeta as SearchConfig
          newDecoSet = createDecorations(tr.doc, config)
        } else if (tr.docChanged) {
          const pluginState = searchHighlightKey.getState(tr.before)
          if (pluginState) {
            const storedConfig = (pluginState as any)._config || defaultConfig
            newDecoSet = createDecorations(tr.doc, storedConfig)
          }
        }

        ;(newDecoSet as any)._config = searchMeta || (oldDecoSet as any)._config || defaultConfig

        return newDecoSet
      }
    },

    props: {
      decorations(state) {
        return searchHighlightKey.getState(state) || DecorationSet.empty
      }
    }
  })
}

export function setSearchQuery(view: any, config: SearchConfig) {
  if (!view) return

  const tr = view.state.tr.setMeta('search', config)
  view.dispatch(tr)
}

export function clearSearchHighlight(view: any) {
  if (!view) return

  const tr = view.state.tr.setMeta('search', {
    search: '',
    caseSensitive: false,
    wholeWord: false,
    regexp: false
  })
  view.dispatch(tr)
}
