import { editorViewCtx } from '@milkdown/kit/core'
import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey, EditorState, Transaction, TextSelection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import { useTabsStore } from '@/stores/tabs'
import { EDITOR } from '@/constants'

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
  matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>
}

interface SearchResult {
  current: number
  total: number
}

const searchPluginKey = new PluginKey<SearchState>('search-highlight')

// 搜索缓存类
class SearchCache {
  private cache: {
    [key: string]: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>
  } = {}

  // 生成缓存键
  private getKey(query: SearchQuery): string {
    return `${query.search}|${query.caseSensitive}|${query.wholeWord}|${query.regexp}`
  }

  // 获取缓存的搜索结果
  get(query: SearchQuery): Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> | null {
    const key = this.getKey(query)
    return this.cache[key] || null
  }

  // 设置缓存
  set(query: SearchQuery, matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>): void {
    const key = this.getKey(query)
    this.cache[key] = matches
  }

  // 清除所有缓存
  clear(): void {
    this.cache = {}
  }
}

const searchCache = new SearchCache()

// 统一的搜索函数 - 只遍历一次文档
function findAllMatches(doc: Node, query: SearchQuery): Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> {
  const matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> = []
  
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

// 根据搜索结果构建装饰
function buildDecorationsFromMatches(doc: Node, matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }>, sel: Selection): DecorationSet {
  const decorations: Decoration[] = []
  
  matches.forEach((match) => {
    const isActive = match.from === sel.from && match.to === sel.to
    decorations.push(
      Decoration.inline(match.from, match.to, {
        class: isActive ? 'ProseMirror-active-search-match' : 'ProseMirror-search-match'
      })
    )
  })
  
  return DecorationSet.create(doc, decorations)
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
      totalMatches: 0,
      matches: []
    }),
    apply: (tr: Transaction, value: SearchState, _prevState: EditorState, state: EditorState): SearchState => {
      const newState = { ...value }
      
      // 如果文档实际变化了
      if (tr.docChanged) {
        // 清除缓存
        searchCache.clear()
        
        // 如果有活跃的搜索查询，立即重新搜索（保持搜索结果准确）
        // 注意：由于文档变化时需要保持结果准确，我们不使用防抖
        // 防抖已经在 useWorkspaceSearch 层面处理（输入时防抖）
        if (value.query && value.query.search) {
          const matches = findAllMatches(state.doc, value.query)
          searchCache.set(value.query, matches)
          
          newState.matches = matches
          newState.totalMatches = matches.length
          newState.currentMatchIndex = 0
          newState.decorations = buildDecorationsFromMatches(state.doc, matches, state.selection)
        } else {
          // 没有搜索查询，清除所有
          newState.decorations = DecorationSet.empty
          newState.matches = []
          newState.totalMatches = 0
          newState.currentMatchIndex = 0
        }
        
        return newState
      }
      
      newState.decorations = newState.decorations.map(tr.mapping, tr.doc)
      
      const searchMeta = tr.getMeta(searchPluginKey)
      if (searchMeta) {
        const { type, query } = searchMeta as { type: string; query: SearchQuery }
        if (type === 'set' && query) {
          newState.query = query
          
          // 先尝试从缓存获取
          const matches = searchCache.get(query)
          if (matches) {
            newState.matches = matches
            newState.totalMatches = matches.length
            newState.decorations = buildDecorationsFromMatches(state.doc, matches, state.selection)
          } else {
            // 执行新的搜索
            const newMatches = findAllMatches(state.doc, query)
            searchCache.set(query, newMatches)
            newState.matches = newMatches
            newState.totalMatches = newMatches.length
            newState.decorations = buildDecorationsFromMatches(state.doc, newMatches, state.selection)
          }
          newState.currentMatchIndex = 0
        } else if (type === 'clear') {
          newState.query = null
          newState.decorations = DecorationSet.empty
          newState.currentMatchIndex = 0
          newState.totalMatches = 0
          newState.matches = []
        }
      } else if (tr.selectionSet && newState.query && newState.matches.length > 0) {
        // 只更新当前匹配的高亮，不重新搜索
        newState.decorations = buildDecorationsFromMatches(state.doc, newState.matches, state.selection)
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
  private editor: { action: (callback: (ctx: { get: (key: unknown) => EditorView }) => void) => void } | null = null

  init(editor: { action: (callback: (ctx: { get: (key: unknown) => EditorView }) => void) => void }) {
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

  // 增强滚动：确保匹配项可见
  private ensureMatchVisible(view: EditorView, pos: number): void {
    // 延迟执行，确保编辑器已经更新
    setTimeout(() => {
      try {
        // 找到滚动容器 - 参考 DocumentOutline 的实现
        let scrollContainer: HTMLElement | null = null
        
        // 获取当前视图模式
        const tabsStore = useTabsStore()
        const activeTab = tabsStore.activeTab
        const viewMode = activeTab?.viewMode
        
        if (viewMode === EDITOR.VIEW_MODES.WYSIWYG) {
          scrollContainer = document.querySelector('.editor-wysiwyg') as HTMLElement
        } else if (viewMode === EDITOR.VIEW_MODES.SPLIT) {
          scrollContainer = document.querySelector('.editor-split-preview') as HTMLElement
        }
        
        // 如果没找到，尝试使用备用方式
        if (!scrollContainer) {
          // 查找最近的滚动容器
          scrollContainer = view.dom.closest('.editor-wysiwyg, .editor-split-preview, .milkdown') as HTMLElement
        }
        
        if (!scrollContainer) {
          // 最后的备选：查找任何可滚动的容器
          scrollContainer = view.dom.closest('[class*="editor"], .milkdown') as HTMLElement
        }
        
        if (!scrollContainer) return
        
        // 找到匹配项的 DOM 元素
        let targetElement: HTMLElement | null = null
        
        const domResult = view.domAtPos(pos)
        if (domResult && domResult.node) {
          if (domResult.node.nodeType === Node.ELEMENT_NODE) {
            targetElement = domResult.node as HTMLElement
          } else if (domResult.node.nodeType === Node.TEXT_NODE) {
            targetElement = (domResult.node as Text).parentElement
          }
        }
        
        if (!targetElement) return
        
        // 计算目标元素相对于滚动容器的位置
        const elementRect = targetElement.getBoundingClientRect()
        const containerRect = scrollContainer.getBoundingClientRect()
        
        // 检查元素是否完全可见
        const isVisible = (
          elementRect.top >= containerRect.top &&
          elementRect.bottom <= containerRect.bottom
        )
        
        // 如果不可见，则滚动
        if (!isVisible) {
          const scrollTop = scrollContainer.scrollTop
          const relativeTop = elementRect.top - containerRect.top
          const targetScrollTop = scrollTop + relativeTop - 50 // 留出一些边距
          
          scrollContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          })
        }
      } catch (error) {
        // 忽略滚动错误
      }
    }, 50)
  }

  search(query: { search: string; caseSensitive?: boolean; wholeWord?: boolean; regexp?: boolean }): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    const state = view.state
    const searchQuery: SearchQuery = {
      search: query.search,
      caseSensitive: query.caseSensitive ?? false,
      wholeWord: query.wholeWord ?? false,
      regexp: query.regexp ?? false,
    }

    // 先检查缓存
    let matches = searchCache.get(searchQuery)
    if (!matches) {
      matches = findAllMatches(state.doc, searchQuery)
      searchCache.set(searchQuery, matches)
    }

    // 通过插件更新状态
    const tr = state.tr.setMeta(searchPluginKey, { type: 'set', query: searchQuery })
    view.dispatch(tr)

    const sel = state.selection
    let currentMatchIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)
    if (currentMatchIndex === -1 && matches.length > 0) {
      currentMatchIndex = 0
      const firstMatch = matches[0]
      const selectTr = view.state.tr.setSelection(new TextSelection(state.doc.resolve(firstMatch.from), state.doc.resolve(firstMatch.to))).scrollIntoView()
      view.dispatch(selectTr)
      
      // 增强滚动：确保第一个匹配项可见
      this.ensureMatchVisible(view, firstMatch.from)
    }

    return {
      current: currentMatchIndex,
      total: matches.length
    }
  }

  clearSearch(): void {
    const view = this.getView()
    if (!view) return

    this.editor?.action((ctx: { get: (key: unknown) => EditorView }) => {
      const v = ctx.get(editorViewCtx)
      if (!v || !v.state) return
      const tr = v.state.tr.setMeta(searchPluginKey, { type: 'clear' })
      v.dispatch(tr)
    })
  }

  findNext(): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    const state = view.state
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    // 使用插件中已经缓存的 matches
    const matches = pluginState.matches
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
    
    // 增强滚动：延迟后再次确保匹配项可见
    this.ensureMatchVisible(view, nextMatch.from)
    
    return {
      current: currentIndex,
      total: matches.length
    }
  }

  findPrev(): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    const state = view.state
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    // 使用插件中已经缓存的 matches
    const matches = pluginState.matches
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
    
    // 增强滚动：延迟后再次确保匹配项可见
    this.ensureMatchVisible(view, prevMatch.from)
    
    return {
      current: currentIndex,
      total: matches.length
    }
  }

  replaceNext(replacement: string): SearchResult {
    const view = this.getView()
    if (!view) {
      return { current: 0, total: 0 }
    }

    const state = view.state
    const pluginState = searchPluginKey.getState(state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { current: 0, total: 0 }
    }

    // 使用插件中已经缓存的 matches
    const matches = pluginState.matches
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

    // 替换后需要重新搜索（内容已变化）
    const newState = view.state
    const newMatches = findAllMatches(newState.doc, pluginState.query)
    searchCache.set(pluginState.query, newMatches)
    
    // 更新插件状态
    const updateTr = newState.tr.setMeta(searchPluginKey, { type: 'set', query: pluginState.query })
    view.dispatch(updateTr)
    
    const currentMatchIndex = 0
    if (newMatches.length > 0) {
      const selectTr = newState.tr.setSelection(new TextSelection(newState.doc.resolve(newMatches[0].from), newState.doc.resolve(newMatches[0].to))).scrollIntoView()
      view.dispatch(selectTr)
    }

    return {
      current: currentMatchIndex,
      total: newMatches.length
    }
  }

  replaceAll(replacement: string): { replaced: number } {
    const view = this.getView()
    if (!view) {
      return { replaced: 0 }
    }

    const pluginState = searchPluginKey.getState(view.state)
    if (!pluginState || !pluginState.query || !pluginState.query.search) {
      return { replaced: 0 }
    }

    // 使用插件中已经缓存的 matches
    const matches = pluginState.matches
    if (matches.length === 0) {
      return { replaced: 0 }
    }
    
    const initialState = view.state
    const query = pluginState.query
    let replacedCount = 0
    
    // 构建单个事务，包含所有替换操作，这样所有替换作为一次撤销单元
    let tr = initialState.tr
    
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]
      
      if (match.to > initialState.doc.content.size) {
        continue
      }
      
      let replacedText: string
      
      if (query.regexp && match.match) {
        replacedText = replacement
        const regexMatch = match.match
        
        replacedText = replacedText.replace(/\$(\d+|&)/g, (fullMatch, groupId) => {
          if (groupId === '&') {
            return regexMatch[0] || ''
          }
          const groupNum = parseInt(groupId, 10)
          return regexMatch[groupNum] || ''
        })
      } else {
        replacedText = replacement
      }
      
      tr = tr.replaceWith(match.from, match.to, initialState.schema.text(replacedText))
      replacedCount++
      
      if (replacedCount > 10000) {
        break
      }
    }
    
    // 一次性提交所有替换操作，作为单次撤销单元
    if (replacedCount > 0) {
      view.dispatch(tr)
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
