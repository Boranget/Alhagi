import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet, EditorView } from '@milkdown/prose/view'
import { SearchConfig, buildSearchPattern } from '@/utils/search'

export { SearchConfig } from '@/utils/search'

const searchHighlightKey = new PluginKey<DecorationSet>('search-highlight')

function createDecorations(doc: { descendants: (fn: (node: any, pos: number) => void) => void }, config: SearchConfig): DecorationSet {
  const decorations: Decoration[] = []

  if (!config.search.trim()) {
    return DecorationSet.empty
  }

  const pattern = buildSearchPattern(config)
  if (!pattern) {
    return DecorationSet.empty
  }

  doc.descendants((node: { isText: boolean; text: string }, pos: number) => {
    if (node.isText && node.text) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(node.text)) !== null) {
        decorations.push(
          Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
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

        const searchMeta = tr.getMeta('search') as SearchConfig | undefined
        if (searchMeta) {
          newDecoSet = createDecorations(tr.doc, searchMeta)
        } else if (tr.docChanged) {
          const oldState = searchHighlightKey.getState(tr.before)
          const storedConfig = (oldState as any)?._config || defaultConfig
          newDecoSet = createDecorations(tr.doc, storedConfig)
        }

        (newDecoSet as any)._config = searchMeta || (oldDecoSet as any)?._config || defaultConfig

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

export function setSearchQuery(view: EditorView, config: SearchConfig) {
  if (!view) return

  const tr = view.state.tr.setMeta('search', config)
  view.dispatch(tr)
}

export function clearSearchHighlight(view: EditorView) {
  if (!view) return

  const tr = view.state.tr.setMeta('search', {
    search: '',
    caseSensitive: false,
    wholeWord: false,
    regexp: false
  })
  view.dispatch(tr)
}

