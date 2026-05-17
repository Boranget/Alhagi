import { editorStateCtx, editorViewCtx } from '@milkdown/core'
import type { Editor } from '@milkdown/core'

export interface SmartReplaceOptions {
  searchText: string
  replaceText: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

export function smartReplace(
  editor: Editor,
  options: SmartReplaceOptions
): boolean {
  let success = false

  editor.action((ctx) => {
    const context = ctx as { get: (key: unknown) => unknown }
    const view = context.get(editorViewCtx) as any
    const state = context.get(editorStateCtx) as any

    if (!view || !state) {
      console.error('Editor view or state not available')
      return
    }

    const { selection } = state
    const { from, to } = selection

    // 如果有选区，替换选区内容
    // 如果没有选区，查找当前位置附近的匹配
    let targetFrom = from
    let targetTo = to

    if (from === to) {
      // 没有选区，查找下一个匹配
      const matches = findMatchesInDocument(state.doc, options)
      const match = matches.find(m => m.from >= from)
      
      if (match) {
        targetFrom = match.from
        targetTo = match.to
      } else {
        // 从头开始查找
        const firstMatch = matches[0]
        if (firstMatch) {
          targetFrom = firstMatch.from
          targetTo = firstMatch.to
        } else {
          return
        }
      }
    }

    // 使用 ProseMirror Transaction 替换
    const tr = state.tr.replaceWith(
      targetFrom,
      targetTo,
      state.schema.text(options.replaceText)
    )
    
    view.dispatch(tr)
    success = true
  })

  return success
}

export function smartReplaceAll(
  editor: Editor,
  options: SmartReplaceOptions
): number {
  let replaceCount = 0

  editor.action((ctx) => {
    const context = ctx as { get: (key: unknown) => unknown }
    const view = context.get(editorViewCtx) as any
    const state = context.get(editorStateCtx) as any

    if (!view || !state) {
      console.error('Editor view or state not available')
      return
    }

    const matches = findMatchesInDocument(state.doc, options)
    
    if (matches.length === 0) {
      return
    }

    // 从后往前替换，避免位置偏移
    let tr = state.tr
    const sortedMatches = [...matches].sort((a, b) => b.from - a.from)

    for (const match of sortedMatches) {
      tr = tr.replaceWith(
        match.from,
        match.to,
        state.schema.text(options.replaceText)
      )
      replaceCount++
    }

    view.dispatch(tr)
  })

  return replaceCount
}

export interface MatchInfo {
  from: number
  to: number
  text: string
}

function findMatchesInDocument(
  doc: any,
  options: SmartReplaceOptions
): MatchInfo[] {
  const matches: MatchInfo[] = []

  // 构建正则表达式
  let searchText = options.searchText
  if (!options.regexp) {
    searchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  if (options.wholeWord) {
    searchText = `\\b${searchText}\\b`
  }

  const flags = options.caseSensitive ? 'g' : 'gi'
  let pattern: RegExp
  try {
    pattern = new RegExp(searchText, flags)
  } catch {
    return matches
  }

  // 在文档树上搜索
  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(node.text)) !== null) {
        matches.push({
          from: pos + match.index,
          to: pos + match.index + match[0].length,
          text: match[0]
        })
      }
    }
    return true
  })

  return matches
}

