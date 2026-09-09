import { RangeSetBuilder, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { SearchQuery } from '@codemirror/search'

interface CodeBlockSearchState {
  query: SearchQuery | null
  decorations: DecorationSet
}

const codeBlockSearchEffect = StateEffect.define<{ query: SearchQuery | null; activeFrom: number; activeTo: number }>()

const searchMatchMark = Decoration.mark({ class: 'cm-searchMatch' })
const selectedSearchMatchMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

const codeBlockSearchTheme = EditorView.baseTheme({
  '&light .cm-searchMatch': { backgroundColor: '#ffff0054' },
  '&dark .cm-searchMatch': { backgroundColor: '#00ffff8a' },
  '&light .cm-searchMatch-selected': { backgroundColor: '#ff6a0054' },
  '&dark .cm-searchMatch-selected': { backgroundColor: '#ff00ff8a' },
})

function buildSearchDecorations(state: EditorState, query: SearchQuery | null, activeFrom: number, activeTo: number): DecorationSet {
  if (!query || !query.valid) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  const cursor = query.getCursor(state)
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    const isActive = next.value.from === activeFrom && next.value.to === activeTo
    builder.add(next.value.from, next.value.to, isActive ? selectedSearchMatchMark : searchMatchMark)
  }
  return builder.finish()
}

// --- Registry: CodeMirror EditorView → getPos function ---
// 存 getPos 函数而非数字，文档编辑后位置自动更新
const registeredViews = new Map<EditorView, () => number>()

function registerCodeBlock(getPos: () => number, view: EditorView): void {
  registeredViews.set(view, getPos)
}

/**
 * 向目标代码块设置 active match，其他代码块清除 active
 */
export function updateCodeBlockSearchQuery(
  query: SearchQuery | null,
  codeBlockPmPos: number,
  activeFrom: number,
  activeTo: number,
): void {
  // 先清除所有代码块的 active 高亮（保留黄色搜索匹配）
  registeredViews.forEach((_getPos, view) => {
    view.dispatch({
      effects: [codeBlockSearchEffect.of({ query, activeFrom: -1, activeTo: -1 })],
    })
  })

  // 再向目标代码块设置 active match
  registeredViews.forEach((getPos, view) => {
    const currentPmPos = getPos()
    if (currentPmPos === codeBlockPmPos) {
      let cmActiveFrom = -1
      let cmActiveTo = -1
      if (activeFrom >= 0 && activeTo >= 0) {
        cmActiveFrom = activeFrom - codeBlockPmPos - 1
        cmActiveTo = activeTo - codeBlockPmPos - 1
      }
      view.dispatch({
        effects: [codeBlockSearchEffect.of({ query, activeFrom: cmActiveFrom, activeTo: cmActiveTo })],
      })
    }
  })
}

/**
 * updateAllCodeBlockSearch — 向所有已注册代码块分发搜索查询（无活跃 match）
 */
export function updateAllCodeBlockSearch(query: SearchQuery | null): void {
  registeredViews.forEach((_pos, view) => {
    view.dispatch({
      effects: [codeBlockSearchEffect.of({ query, activeFrom: -1, activeTo: -1 })],
    })
  })
}

/**
 * clearAllCodeBlockSearch — 清除所有已注册代码块的搜索高亮
 */
export function clearAllCodeBlockSearch(): void {
  registeredViews.forEach((_pos, view) => {
    view.dispatch({
      effects: [codeBlockSearchEffect.of({ query: null, activeFrom: -1, activeTo: -1 })],
    })
  })
}

/**
 * Extension for search highlighting inside embedded CodeMirror code blocks.
 *
 * Each CM instance:
 *   1. Registers itself in codeBlockRegistry with its PM position
 *   2. Receives search effects dispatched by updateCodeBlockSearchQuery()
 *   3. Builds cm-searchMatch / cm-searchMatch-selected decorations independently
 */
export function codeBlockSearchHighlight(): Extension {
  const searchHighlightField = StateField.define<CodeBlockSearchState>({
    create: () => ({ query: null, decorations: Decoration.none }),

    update(value, tr) {
      let nextQuery = value.query
      let nextActiveFrom = -1
      let nextActiveTo = -1

      for (const effect of tr.effects) {
        if (effect.is(codeBlockSearchEffect)) {
          nextQuery = effect.value.query
          nextActiveFrom = effect.value.activeFrom
          nextActiveTo = effect.value.activeTo
        }
      }

      const decorations = buildSearchDecorations(tr.state, nextQuery, nextActiveFrom, nextActiveTo)
      return { query: nextQuery, decorations }
    },
  })

  const searchHighlightPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    private rafId = -1

    constructor(private view: EditorView) {
      // CM view 创建时还没挂载到 DOM，需要延迟查找 PM 位置
      if (view.dom.parentElement) {
        this.registerFromDom()
      } else {
        this.deferredRegistration()
      }

      const state = this.view.state.field(searchHighlightField)
      this.decorations = state.decorations
    }

    private deferredRegistration() {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = -1
        this.registerFromDom()
      })
    }

    private registerFromDom() {
      let el: Element | null = this.view.dom
      let depth = 0
      while (el && depth < 20) {
        const pmDesc = (el as any).pmViewDesc
        if (pmDesc?.node?.type?.name === 'code_block') {
          // 存 getPos 函数而非数字，文档编辑后位置自动更新
          const getPos = pmDesc.spec?.getPos
          if (getPos) {
            registerCodeBlock(getPos, this.view)
          }
          break
        }
        el = el.parentElement
        depth++
      }
    }

    update(update: ViewUpdate) {
      const state = update.state.field(searchHighlightField)
      if (state.decorations !== this.decorations || update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = state.decorations
      }
    }

    destroy() {
      if (this.rafId >= 0) cancelAnimationFrame(this.rafId)
    }
  }, {
    decorations: plugin => plugin.decorations,
  })

  return [searchHighlightField, searchHighlightPlugin, codeBlockSearchTheme]
}
