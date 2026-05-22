import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core'
import { $prose, getMarkdown } from '@milkdown/kit/utils'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Slice, Fragment } from '@milkdown/kit/prose/model'
import { Selection, TextSelection, Plugin, PluginKey, EditorState, Transaction } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import { nord } from '@uiw/codemirror-theme-nord'
import type { ViewMode } from '@/types'
import type { HeadingItem } from '@/utils/headings'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { LRUCache } from '@/utils/performance'
import { debounce } from '@/utils/helpers'
import { generateSlug } from '@/utils/headings'

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

const searchPluginKey = new PluginKey<SearchState>('search-highlight')

// 文本内容缓存，提升搜索性能
const TextContentCache = new WeakMap<any, string>()

function textContent(node: any): string {
  const cached = TextContentCache.get(node)
  if (cached) return cached
  
  let content = ''
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child.isText) {
      content += child.text
    } else if (child.isLeaf) {
      content += '\ufffc'
    } else {
      content += ' ' + textContent(child) + ' '
    }
  }
  TextContentCache.set(node, content)
  return content
}

// 解析替换文本中的分组占位符 ($1, $& 等)
function parseReplacement(text: string): Array<string | { group: number; copy: boolean }> {
  const result: Array<string | { group: number; copy: boolean }> = []
  let highestSeen = -1

  function add(part: string) {
    const last = result.length - 1
    if (last > -1 && typeof result[last] === 'string') {
      result[last] += part
    } else {
      result.push(part)
    }
  }

  let remaining = text
  while (remaining.length) {
    const match = /\$([$&\d+])/.exec(remaining)
    if (!match) {
      add(remaining)
      return result
    }
    if (match.index > 0) {
      add(remaining.slice(0, match.index + (match[1] === '$' ? 1 : 0)))
    }
    if (match[1] !== '$') {
      const n = match[1] === '&' ? 0 : +match[1]
      if (highestSeen >= n) {
        result.push({ group: n, copy: true })
      } else {
        highestSeen = n || 1000
        result.push({ group: n, copy: false })
      }
    }
    remaining = remaining.slice(match.index + match[0].length)
  }
  return result
}

// 获取分组索引
function getGroupIndices(match: RegExpExecArray): Array<[number, number] | undefined> {
  if ((match as any).indices) return (match as any).indices
  const result: Array<[number, number] | undefined> = [[0, match[0].length]]
  for (let i = 1, pos = 0; i < match.length; i++) {
    const found = match[i] ? match[0].indexOf(match[i], pos) : -1
    result.push(found < 0 ? undefined : [found, pos = found + match[i].length])
  }
  return result
}

function buildSearchDecorations(state: EditorState, query: SearchQuery): { decorations: DecorationSet; total: number } {
  const decorations: Decoration[] = []
  let matchIndex = 0
  
  console.log('[Search] buildSearchDecorations called with query:', {
    search: query.search,
    caseSensitive: query.caseSensitive,
    wholeWord: query.wholeWord,
    regexp: query.regexp
  })
  
  const doc = state.doc
  const sel = state.selection
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      const text = node.text
      let regex: RegExp | null = null
      
      try {
        let pattern = query.search
        console.log('[Search] Building regex pattern:', {
          originalSearch: query.search,
          regexpMode: query.regexp
        })
        
        if (!query.regexp) {
          pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          console.log('[Search] Escaped pattern:', pattern)
        }
        
        if (query.wholeWord) {
          pattern = `\\b${pattern}\\b`
          console.log('[Search] Whole word pattern:', pattern)
        }
        
        const flags = query.caseSensitive ? 'g' : 'gi'
        regex = new RegExp(pattern, flags)
        console.log('[Search] Final regex created:', regex)
      } catch (e) {
        console.error('[Search] Error creating regex:', e)
        return
      }

      let match: RegExpExecArray | null
      console.log('[Search] Searching in text:', text)
      
      while ((match = regex.exec(text)) !== null) {
        console.log('[Search] Found match:', {
          matchText: match[0],
          index: match.index,
          from: pos + match.index,
          to: pos + match.index + match[0].length
        })
        
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
      
      if (matchIndex === 0) {
        console.log('[Search] No matches found in text')
      }
    }
  })

  console.log('[Search] Total matches found:', matchIndex)
  
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
      let newState = { ...value }
      
      newState.decorations = newState.decorations.map(tr.mapping, tr.doc)
      
      const searchMeta = tr.getMeta(searchPluginKey)
      if (searchMeta) {
        const { type, query } = searchMeta
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

export class CrepeEditorManager {
  private crepe: Crepe | null = null
  private content: string = ''
  private currentTabId: string | null = null
  private currentMode: ViewMode = 'wysiwyg'
  private contentCache: LRUCache<string>
  private isUpdatingContent = false
  private isInitialized = false
  private activeEditor: 'crepe' | 'codemirror' | null = null
  private container: HTMLElement | null = null
  private cursorChangeHandler: ((from: number, to: number) => void) | null = null

  constructor() {
    this.contentCache = new LRUCache<string>(20)
  }

setActiveEditor(editor: 'crepe' | 'codemirror' | null): void {
    this.activeEditor = editor
    eventBus.emit(AppEvents.ACTIVE_EDITOR_CHANGED, { editor })
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.activeEditor
  }

  /**
   * 注册光标变化回调，供大纲组件使用
   */
  onCursorChange(handler: (from: number, to: number) => void): void {
    this.cursorChangeHandler = handler
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    if (!container) {
      console.error('[CrepeEditorManager] Container is undefined, cannot initialize')
      return
    }

    const startTime = performance.now()

    this.content = initialContent
    this.currentTabId = tabId || null
    this.container = container

    const isDark = this.isDarkMode()
    
    this.crepe = new Crepe({
      root: container,
      defaultValue: initialContent,
      features: {
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.Placeholder]: true,
        [Crepe.Feature.Cursor]: false,
      },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          theme: isDark ? undefined : eclipse,
        },
      },
    })

    this.crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(
          debounce((...args: unknown[]) => {
            const markdown = args[1] as string
            this.handleMarkdownUpdate(markdown)
          }, 200)
        )

        // 监听编辑器更新（包括光标/选区变化）
        ctx.get(listenerCtx).updated((ctx) => {
          try {
            const view = ctx.get(editorViewCtx)
            const { from, to } = view.state.selection
            this.emitCursorChange(from, to)
          } catch {
            // 初始化时可能还拿不到 view
          }
        })
      })
      .use(listener)
      .use(searchPlugin)

    try {
      await this.crepe.create()
    } catch (error) {
      console.error('[CrepeEditorManager] crepe.create() failed:', error)
      throw error
    }

    this.isInitialized = true
    const initTime = performance.now() - startTime

    if (this.currentTabId) {
      eventBus.emit(AppEvents.EDITOR_READY, { tabId: this.currentTabId })
    } else {
      eventBus.emit(AppEvents.EDITOR_READY, { tabId: null })
    }
  }

  getMarkdown(): string {
    if (!this.crepe || !this.isInitialized) {
      console.warn('[CrepeEditorManager] Cannot get markdown: Crepe not initialized')
      return this.content
    }

    try {
      const markdown = this.crepe.getMarkdown()
      return markdown || this.content
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to get markdown:', error)
      return this.content
    }
  }

  async setMarkdown(content: string): Promise<void> {
    if (!this.crepe) {
      console.warn('[CrepeEditorManager] Cannot set markdown: Crepe not initialized')
      return
    }

    if (this.content === content) {
      return
    }

    if (this.isUpdatingContent) {
      return
    }

    this.isUpdatingContent = true
    this.content = content

    const startTime = performance.now()

    try {
      this.crepe.editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx)
          const parser = ctx.get(parserCtx)
          const doc = parser(content)

          if (!doc) {
            console.error('[CrepeEditorManager] Failed to parse markdown')
            return
          }

          const state = view.state
          const { from } = state.selection
          let tr = state.tr

          tr = tr.replace(
            0,
            state.doc.content.size,
            new Slice(doc.content, 0, 0)
          )

          const docSize = doc.content.size
          const safeFrom = Math.min(from, docSize - 2)
          tr = tr.setSelection(Selection.near(tr.doc.resolve(safeFrom)))
          view.dispatch(tr)
        } catch (innerError) {
          console.error('[CrepeEditorManager] Error updating editor:', innerError)
        }
      })

      const setTime = performance.now() - startTime

      if (this.currentTabId) {
        this.contentCache.set(this.currentTabId, content)
      }
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to set markdown:', error)
    } finally {
      this.isUpdatingContent = false
    }
  }

  getHTML(): string {
    if (!this.crepe || !this.isInitialized) {
      console.warn('[CrepeEditorManager] Cannot get HTML: Crepe not initialized')
      return ''
    }

    try {
      let html = ''
      this.crepe.editor.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx)
          if (view) {
            const dom = view.dom.querySelector('.milkdown')
            if (dom) {
              html = dom.innerHTML
            }
          }
        } catch (innerError) {
          console.error('[CrepeEditorManager] Failed to get editor view context:', innerError)
        }
      })
      return html
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to get HTML:', error)
      return ''
    }
  }

  setViewMode(mode: ViewMode): void {
    this.currentMode = mode

    if (this.currentTabId) {
      const tabsStore = useTabsStore()
      tabsStore.setViewMode(this.currentTabId, mode)
    }
  }

  getViewMode(): ViewMode {
    return this.currentMode
  }

  async switchToTab(tabId: string): Promise<void> {
    if (!this.crepe) {
      console.warn('[CrepeEditorManager] Cannot switch tab: Crepe not initialized')
      return
    }
    
    if (this.currentTabId === tabId) {
      return
    }

    const tabsStore = useTabsStore()
    const tab = tabsStore.tabs.get(tabId)

    if (!tab) {
      console.error(`[CrepeEditorManager] Tab not found: ${tabId}`)
      return
    }

    const previousTabId = this.currentTabId
    this.currentTabId = tabId
    this.currentMode = tab.viewMode

    if (tab.content !== this.content) {
      await this.setMarkdown(tab.content)
    } else {
      this.content = tab.content
    }

    eventBus.emit(AppEvents.TAB_SWITCHED, { tabId, previousTabId: previousTabId || undefined })
  }

  async destroy(): Promise<void> {
    if (this.crepe) {
      this.crepe.destroy()
      this.crepe = null
    }

    this.content = ''
    this.currentTabId = null
    this.container = null
    this.isInitialized = false
    this.cursorChangeHandler = null
    this.contentCache.clear()

    eventBus.emit(AppEvents.EDITOR_DESTROYED, { tabId: this.currentTabId })
  }

  isReady(): boolean {
    return this.isInitialized && this.crepe !== null
  }

  /**
   * 在 ProseMirror/WYSIWYG 编辑器中滚动到指定标题
   * 
   * 实现原理（参考 MarkText/Typora）：
   * 1. 直接使用 ProseMirror 节点位置（pos）定位
   * 2. 通过 ProseMirror 的 nodeDOM API 找到标题对应的 DOM 元素
   * 3. 定位到真正的滚动容器（.editor-wysiwyg 或 .editor-split-preview）
   * 4. 计算标题相对于滚动容器的位置
   * 5. 使用 scrollTo 执行平滑滚动
   * 
   * @param text - 标题文本内容（仅用于日志，不参与定位）
   * @param line - 标题所在行号（仅用于日志，不参与定位）
   * @param pos - ProseMirror 节点位置（必需，用于精确定位）
   */
  scrollToHeading(text: string, line: number, pos?: number): void {
    if (!this.crepe || !this.isInitialized) return
    
    // pos 是必需的，如果没有提供则无法定位
    if (pos === undefined || pos < 0) {
      console.warn('[CrepeEditorManager] scrollToHeading: pos is required but not provided')
      return
    }

    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const targetPos = pos
        
        // 直接使用 pos 进行定位
        const resolvedPos = view.state.doc.resolve(targetPos)
        // 关键：在 transaction 上调用 scrollIntoView()，让 ProseMirror 知道需要滚动
        const tr = view.state.tr
          .setSelection(Selection.near(resolvedPos, 1))
          .scrollIntoView()
        
        view.dispatch(tr)
        view.focus()

        // 延迟执行 DOM 滚动，确保 ProseMirror 已更新 DOM
        setTimeout(() => {
          try {
            // 步骤 1: 获取标题对应的 DOM 元素
            // 优先使用 ProseMirror 的 nodeDOM API，它返回节点对应的真实 DOM
            const node = view.state.doc.nodeAt(targetPos)
            let targetElement: HTMLElement | null = null
            
            if (node) {
              const dom = view.nodeDOM(targetPos)
              if (dom instanceof HTMLElement) {
                targetElement = dom
              } else if (dom && dom.nodeType === Node.TEXT_NODE) {
                targetElement = (dom as Text).parentElement
              }
            }
            
            // 备用方案：如果 nodeDOM 失败，通过 domAtPos 查找最近的 heading 元素
            if (!targetElement) {
              const domResult = view.domAtPos(targetPos)
              if (domResult && domResult.node) {
                if (domResult.node.nodeType === Node.ELEMENT_NODE) {
                  const el = domResult.node as HTMLElement
                  // 如果直接就是 heading 元素
                  if (el.tagName && /^H[1-6]$/.test(el.tagName)) {
                    targetElement = el
                  } else {
                    // 否则向上查找最近的 heading 父元素
                    targetElement = el.closest('h1, h2, h3, h4, h5, h6')
                  }
                } else {
                  // 文本节点，向上查找 heading
                  targetElement = (domResult.node as Text).parentElement?.closest('h1, h2, h3, h4, h5, h6') || null
                }
              }
            }
            
            if (!targetElement) return
            
            // 步骤 2: 找到真正的滚动容器
            // 注意：必须是具有 overflow: auto/scroll 的容器，而不是任意父元素
            let scrollContainer: HTMLElement | null = targetElement.closest('.editor-wysiwyg, .editor-split-preview')
            
            // 如果没找到，尝试从 view.dom 向上查找
            if (!scrollContainer) {
              scrollContainer = view.dom.parentElement?.closest('.editor-wysiwyg, .editor-split-preview') || null
            }
            
            if (!scrollContainer) return
            
            // 步骤 3: 计算滚动位置
            // 使用 getBoundingClientRect 获取相对于视口的位置，避免受 CSS transform 影响
            const elementRect = targetElement.getBoundingClientRect()
            const containerRect = scrollContainer.getBoundingClientRect()
            
            // 计算公式：
            // relativeTop = 标题相对于视口的位置 - 容器相对于视口的位置
            //             = 标题相对于容器顶部的位置
            // targetScrollTop = 当前滚动位置 + 相对位置 - 边距
            const scrollTop = scrollContainer.scrollTop
            const relativeTop = elementRect.top - containerRect.top
            const targetScrollTop = scrollTop + relativeTop - 20 // 留 20px 边距，让标题不紧贴顶部
            
            // 步骤 4: 执行平滑滚动
            // 使用 Math.max(0, ...) 确保滚动位置不为负数
            scrollContainer.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            })
          } catch (scrollError) {
            console.error('[CrepeEditorManager] Smooth scroll error:', scrollError)
          }
        }, 50)

        // 额外触发一次光标变化通知，更新大纲高亮状态
        const { from, to } = view.state.selection
        this.emitCursorChange(from, to)
      } catch (error) {
        console.error('[CrepeEditorManager] scrollToHeading error:', error)
      }
    })
  }

  /**
   * 获取当前光标在 WYSIWYG 编辑器中所在的行号（相对于整个文档文本）
   */
  getCurrentCursorLine(): number {
    if (!this.crepe || !this.isInitialized) return 0

    let line = 0
    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const { from } = view.state.selection
        // 通过内容文本计算行号
        const text = view.state.doc.textBetween(0, from)
        line = text.split('\n').length
      } catch {
        line = 0
      }
    })
    return line
  }

  /**
   * 从 ProseMirror 文档中获取所有标题及其节点位置
   * 
   * @returns 包含 pos 信息的标题列表
   */
  getHeadingsWithPos(): HeadingItem[] {
    if (!this.crepe || !this.isInitialized) return []
    
    const headings: HeadingItem[] = []
    
    this.crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const doc = view.state.doc
        
        // 遍历 ProseMirror 文档查找所有标题节点
        doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            const text = node.textContent.trim()
            const level = node.attrs.level || 1
            
            // 计算行号（通过统计之前的换行符）
            const textBefore = doc.textBetween(0, pos)
            const line = textBefore.split('\n').length
            
            headings.push({
              text,
              level,
              slug: generateSlug(text),
              line,
              pos  // 存储 ProseMirror 节点位置
            })
          }
        })
      } catch (error) {
        console.error('[CrepeEditorManager] Failed to get headings with pos:', error)
      }
    })
    
    return headings
  }

  private emitCursorChange(from: number, to: number): void {
    if (this.currentTabId) {
      eventBus.emit(AppEvents.CURSOR_CHANGED, {
        from,
        to,
        tabId: this.currentTabId,
      })
    }
    this.cursorChangeHandler?.(from, to)
  }

  private handleMarkdownUpdate(markdown: string): void {
    if (this.isUpdatingContent) {
      return
    }

    if (this.content === markdown) {
      return
    }

    if (this.activeEditor === 'codemirror') {
      return
    }

    this.content = markdown

    if (this.currentTabId) {
      const tabsStore = useTabsStore()
      tabsStore.updateTab(this.currentTabId, {
        content: markdown,
        isDirty: true,
        lastModified: Date.now(),
      })

      this.contentCache.set(this.currentTabId, markdown)
    }

    eventBus.emit(AppEvents.CONTENT_CHANGED, {
      content: markdown,
      tabId: this.currentTabId || '',
    })
  }

  getCachedContent(tabId: string): string | undefined {
    return this.contentCache.get(tabId)
  }

  setCachedContent(tabId: string, content: string): void {
    this.contentCache.set(tabId, content)
  }

  clearCache(): void {
    this.contentCache.clear()
  }

  private isDarkMode(): boolean {
    const preferences = usePreferencesStore()
    const effectiveTheme = preferences.theme === 'system'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')
      : preferences.theme
    return effectiveTheme === 'dark'
  }

  async updateTheme(): Promise<void> {
    if (!this.crepe || !this.isInitialized || !this.container) {
      console.warn('[CrepeEditorManager] Cannot update theme: Crepe not initialized')
      return
    }
    
    const currentContent = this.getMarkdown()
    const container = this.container
    const tabId = this.currentTabId
    
    await this.destroy()
    await this.init(container, currentContent, tabId || undefined)
  }

  private findAllMatches(state: EditorState, query: SearchQuery): Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> {
    console.log('[Search] findAllMatches called with query:', query)
    
    const matches: Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number }> = []
    
    const doc = state.doc
    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.text && query.search) {
        const text = node.text
        let regex: RegExp | null = null
        
        try {
          let pattern = query.search
          console.log('[Search] findAllMatches building regex:', {
            originalSearch: query.search,
            regexpMode: query.regexp
          })
          
          if (!query.regexp) {
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            console.log('[Search] findAllMatches escaped pattern:', pattern)
          }
          
          if (query.wholeWord) {
            pattern = `\\b${pattern}\\b`
            console.log('[Search] findAllMatches whole word pattern:', pattern)
          }
          
          const flags = query.caseSensitive ? 'g' : 'gi'
          regex = new RegExp(pattern, flags)
          console.log('[Search] findAllMatches final regex:', regex)
        } catch (e) {
          console.error('[Search] findAllMatches error creating regex:', e)
          return
        }

        let match: RegExpExecArray | null
        console.log('[Search] findAllMatches searching in text:', text)
        
        while ((match = regex.exec(text)) !== null) {
          console.log('[Search] findAllMatches found match:', {
            matchText: match[0],
            index: match.index,
            from: pos + match.index,
            to: pos + match.index + match[0].length
          })
          
          matches.push({
            from: pos + match.index,
            to: pos + match.index + match[0].length,
            match: query.regexp ? match : undefined,
            matchStart: pos
          })
        }
      }
    })
    
    console.log('[Search] findAllMatches returning', matches.length, 'matches')
    
    return matches
  }

  // 搜索相关方法
  search(query: { search: string; caseSensitive?: boolean; wholeWord?: boolean; regexp?: boolean }): { current: number; total: number } {
    console.log('[Search] search method called with:', query)
    
    if (!this.crepe || !this.isInitialized) {
      console.log('[Search] Editor not initialized')
      return { current: 0, total: 0 }
    }

    let totalMatches = 0
    let currentMatchIndex = 0

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const state = view.state
      
      const searchQuery: SearchQuery = {
        search: query.search,
        caseSensitive: query.caseSensitive ?? false,
        wholeWord: query.wholeWord ?? false,
        regexp: query.regexp ?? false,
      }

      console.log('[Search] Created SearchQuery object:', searchQuery)

      const tr = state.tr.setMeta(searchPluginKey, { type: 'set', query: searchQuery })
      view.dispatch(tr)

      const matches = this.findAllMatches(state, searchQuery)
      console.log('[Search] findAllMatches returned', matches.length, 'matches')
      totalMatches = matches.length
      
      const sel = state.selection
      currentMatchIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)
      if (currentMatchIndex === -1 && matches.length > 0) {
        currentMatchIndex = 0
        const firstMatch = matches[0]
        const selectTr = view.state.tr.setSelection(new TextSelection(state.doc.resolve(firstMatch.from), state.doc.resolve(firstMatch.to))).scrollIntoView()
        view.dispatch(selectTr)
      }
    })

    console.log('[Search] Returning result:', { current: currentMatchIndex, total: totalMatches })
    
    return {
      current: currentMatchIndex,
      total: totalMatches
    }
  }

  clearSearch(): void {
    if (!this.crepe || !this.isInitialized) {
      return
    }

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const tr = view.state.tr.setMeta(searchPluginKey, { type: 'clear' })
      view.dispatch(tr)
    })
  }

  findNext(): { current: number; total: number } {
    if (!this.crepe || !this.isInitialized) {
      return { current: 0, total: 0 }
    }

    let totalMatches = 0
    let currentMatchIndex = 0

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const state = view.state
      
      const pluginState = searchPluginKey.getState(state)
      if (!pluginState || !pluginState.query || !pluginState.query.search) {
        return
      }

      const matches = this.findAllMatches(state, pluginState.query)
      totalMatches = matches.length
      
      if (matches.length === 0) {
        return
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
    })

    return {
      current: currentMatchIndex,
      total: totalMatches
    }
  }

  findPrev(): { current: number; total: number } {
    if (!this.crepe || !this.isInitialized) {
      return { current: 0, total: 0 }
    }

    let totalMatches = 0
    let currentMatchIndex = 0

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const state = view.state
      
      const pluginState = searchPluginKey.getState(state)
      if (!pluginState || !pluginState.query || !pluginState.query.search) {
        return
      }

      const matches = this.findAllMatches(state, pluginState.query)
      totalMatches = matches.length
      
      if (matches.length === 0) {
        return
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
    })

    return {
      current: currentMatchIndex,
      total: totalMatches
    }
  }

  replaceNext(replacement: string): { current: number; total: number } {
    console.log('[Search] replaceNext called with replacement:', replacement)
    
    if (!this.crepe || !this.isInitialized) {
      return { current: 0, total: 0 }
    }

    let totalMatches = 0
    let currentMatchIndex = 0

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const state = view.state
      
      const pluginState = searchPluginKey.getState(state)
      if (!pluginState || !pluginState.query || !pluginState.query.search) {
        return
      }

      const matches = this.findAllMatches(state, pluginState.query)
      
      if (matches.length === 0) {
        return
      }

      const sel = state.selection
      let currentIndex = matches.findIndex(m => m.from === sel.from && m.to === sel.to)
      
      if (currentIndex === -1) {
        currentIndex = 0
      }

      const match = matches[currentIndex]
      console.log('[Search] Found match to replace:', {
        from: match.from,
        to: match.to,
        matchData: match.match
      })
      
      let tr
      
      // 支持正则分组替换
      if (pluginState.query.regexp && match.match) {
        console.log('[Search] Using regex replacement')
        
        // 简化的替换逻辑：直接使用字符串替换而不是复杂的文档切片
        let replacedText = replacement
        const regexMatch = match.match
        
        console.log('[Search] Original match groups:', regexMatch)
        
        // 替换 $&, $1, $2 等
        replacedText = replacedText.replace(/\$(\d+|&)/g, (fullMatch, groupId) => {
          if (groupId === '&') {
            return regexMatch[0] || ''
          }
          const groupNum = parseInt(groupId, 10)
          return regexMatch[groupNum] || ''
        })
        
        console.log('[Search] Replaced text:', replacedText)
        
        // 简单地替换整个匹配范围
        tr = state.tr.replaceWith(match.from, match.to, state.schema.text(replacedText))
      } else {
        // 普通替换
        console.log('[Search] Using plain text replacement')
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
    })

    return {
      current: currentMatchIndex,
      total: totalMatches
    }
  }

  replaceAll(replacement: string): { replaced: number } {
    console.log('[Search] replaceAll called with replacement:', replacement)
    
    if (!this.crepe || !this.isInitialized) {
      return { replaced: 0 }
    }

    let replacedCount = 0

    this.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      
      const pluginState = searchPluginKey.getState(view.state)
      if (!pluginState || !pluginState.query || !pluginState.query.search) {
        return
      }

      let state = view.state
      let query = pluginState.query
      
      // 先找到所有匹配项
      const matches = this.findAllMatches(state, query)
      console.log('[Search] replaceAll found', matches.length, 'matches')
      
      if (matches.length === 0) {
        return
      }
      
      // 从后向前替换，避免位置偏移问题
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i]
        
        // 检查位置是否还有效（可能前面的替换影响了后面的位置）
        if (match.to > state.doc.content.size) {
          continue
        }
        
        let tr
        
        // 支持正则分组替换
        if (query.regexp && match.match) {
          console.log('[Search] replaceAll using regex replacement for match', i)
          
          // 简化的替换逻辑
          let replacedText = replacement
          const regexMatch = match.match
          
          // 替换 $&, $1, $2 等
          replacedText = replacedText.replace(/\$(\d+|&)/g, (fullMatch, groupId) => {
            if (groupId === '&') {
              return regexMatch[0] || ''
            }
            const groupNum = parseInt(groupId, 10)
            return regexMatch[groupNum] || ''
          })
          
          console.log('[Search] replaceAll replaced text:', replacedText)
          
          tr = state.tr.replaceWith(match.from, match.to, state.schema.text(replacedText))
        } else {
          // 普通替换
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
    })

    console.log('[Search] replaceAll replaced', replacedCount, 'items')
    
    return { replaced: replacedCount }
  }
}

let crepeEditorManagerInstance: CrepeEditorManager | null = null

export function useCrepeEditorManager(): CrepeEditorManager {
  if (!crepeEditorManagerInstance) {
    crepeEditorManagerInstance = new CrepeEditorManager()
  }
  return crepeEditorManagerInstance
}

export function resetCrepeEditorManager(): void {
  if (crepeEditorManagerInstance) {
    crepeEditorManagerInstance.destroy()
    crepeEditorManagerInstance = null
  }
}

// 搜索高亮相关功能
export function useEditorSearch() {
  const editorManager = useCrepeEditorManager()
  
  function setSearchHighlight(config: { search: string; caseSensitive?: boolean; wholeWord?: boolean; regexp?: boolean }) {
    if (config.search) {
      return editorManager.search(config)
    } else {
      editorManager.clearSearch()
      return { current: 0, total: 0 }
    }
  }
  
  function clearSearchHighlight() {
    editorManager.clearSearch()
  }

  function findNextMatch() {
    return editorManager.findNext()
  }

  function findPrevMatch() {
    return editorManager.findPrev()
  }

  function replaceNextMatch(replacement: string) {
    return editorManager.replaceNext(replacement)
  }

  function replaceAllMatches(replacement: string) {
    return editorManager.replaceAll(replacement)
  }
  
  return {
    setSearchHighlight,
    clearSearchHighlight,
    findNextMatch,
    findPrevMatch,
    replaceNextMatch,
    replaceAllMatches
  }
}