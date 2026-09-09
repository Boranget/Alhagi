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

// --- Registry: CodeMirror EditorView → 注册的 PM position ---
// 用 Map 存储，每个 view 注册一次
const registeredViews = new Map<EditorView, number>()

function registerCodeBlock(pmPos: number, view: EditorView): void {
  registeredViews.set(view, pmPos)
}

/**
 * getPmPosForView — 实时从 CM view 的 DOM 获取当前 PM 位置
 * 比 WeakMap 缓存更可靠，因为 pmViewDesc 会随 DOM 更新
 */
function getPmPosForView(view: EditorView): number {
  let el: Element | null = view.dom
  let depth = 0
  while (el && depth < 20) {
    const pmDesc = (el as any).pmViewDesc
    if (pmDesc?.node?.type?.name === 'code_block') {
      return (pmDesc.posAtStart ?? -1) - 1
    }
    el = el.parentElement
    depth++
  }
  return -1
}

/**
 * updateCodeBlockSearchQuery — 从 CrepeSearchService 调用
 *
 * @param query        CodeMirror SearchQuery（包含搜索选项）
 * @param codeBlockPmPos 代码块在 ProseMirror 文档中的起始位置
 * @param activeFrom   活跃 match 在 ProseMirror 文档中的起始位置（-1 = 无活跃 match）
 * @param activeTo     活跃 match 在 ProseMirror 文档中的结束位置
 */
export function updateCodeBlockSearchQuery(
  query: SearchQuery | null,
  codeBlockPmPos: number,
  activeFrom: number,
  activeTo: number,
): void {
  // 先清除所有代码块的 active 高亮（保留黄色搜索匹配）
  registeredViews.forEach((_pos, view) => {
    view.dispatch({
      effects: [codeBlockSearchEffect.of({ query, activeFrom: -1, activeTo: -1 })],
    })
  })

  // 再向目标代码块设置 active match
  let found = false
  registeredViews.forEach((_registeredPos, view) => {
    const currentPmPos = getPmPosForView(view)
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
      found = true
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
          console.log('[CBSearch:StateField] Effect received', {
            queryValid: effect.value.query?.valid,
            querySearch: effect.value.query?.search,
            activeFrom: effect.value.activeFrom,
            activeTo: effect.value.activeTo,
          })
        }
      }

      const decorations = buildSearchDecorations(tr.state, nextQuery, nextActiveFrom, nextActiveTo)
      console.log('[CBSearch:StateField] Decorations built:', decorations.size)
      return { query: nextQuery, decorations }
    },
  })

  const searchHighlightPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    private pmPos = -1
    private rafId = -1

    constructor(private view: EditorView) {
      console.log('[CBSearch:ViewPlugin] Constructor. view.dom.parentElement:', !!view.dom.parentElement)

      // CM view 创建时还没挂载到 DOM，需要延迟查找 PM 位置
      if (view.dom.parentElement) {
        this.registerFromDom()
      } else {
        console.log('[CBSearch:ViewPlugin] DOM not attached yet, using MutationObserver')
        this.deferredRegistration()
      }

      const state = this.view.state.field(searchHighlightField)
      this.decorations = state.decorations
    }

    private deferredRegistration() {
      // CM view 创建时还没挂载到 DOM（CodeMirrorBlock 先 new EditorView 再 mount）
      // 用 requestAnimationFrame 等待挂载完成
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
        if (pmDesc) {
          console.log('[CBSearch:ViewPlugin] pmViewDesc at depth', depth, 'node:', pmDesc.node?.type?.name, 'posAtStart:', pmDesc.posAtStart)
          if (pmDesc.node?.type?.name === 'code_block') {
            // posAtStart 是 code_block 内容的起始位置（opening fence 之后）
            // findAllMatches 用的是 code_block 节点本身的 pos（opening fence 之前）
            // 所以用 posAtStart - 1 来对齐
            this.pmPos = (pmDesc.posAtStart ?? -1) - 1
            break
          }
        }
        el = el.parentElement
        depth++
      }

      console.log('[CBSearch:ViewPlugin] Final pmPos:', this.pmPos)
      if (this.pmPos >= 0) {
        registerCodeBlock(this.pmPos, this.view)
        console.log('[CBSearch:ViewPlugin] Registered in WeakMap')
      } else {
        console.log('[CBSearch:ViewPlugin] FAILED to find code_block pmPos')
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
      // WeakMap 会在 view 被 GC 时自动清理
    }
  }, {
    decorations: plugin => plugin.decorations,
  })

  return [searchHighlightField, searchHighlightPlugin, codeBlockSearchTheme]
}
