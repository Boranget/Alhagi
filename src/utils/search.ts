import { EditorView } from '@milkdown/prose/view'
import { Node as ProseMirrorNode } from '@milkdown/prose/model'

export interface SearchConfig {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

export interface MatchRange {
  from: number
  to: number
  text: string
}

export interface ReplaceResult {
  success: boolean
  newContent?: string
  error?: string
}

export function buildSearchPattern(config: SearchConfig): RegExp | null {
  if (!config.search) {
    return null
  }

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

export function findMatchesInContent(
  content: string,
  config: SearchConfig
): MatchRange[] {
  const matches: MatchRange[] = []
  const pattern = buildSearchPattern(config)

  if (!pattern) {
    return matches
  }

  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      text: match[0]
    })
  }

  return matches
}

export function findMatchesInDocument(
  doc: ProseMirrorNode,
  config: SearchConfig
): MatchRange[] {
  const matches: MatchRange[] = []
  const pattern = buildSearchPattern(config)

  if (!pattern) {
    return matches
  }

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      let match: RegExpExecArray | null
      const textNodePattern = new RegExp(pattern.source, pattern.flags)

      while ((match = textNodePattern.exec(node.text)) !== null) {
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

export function replaceAllInContent(
  content: string,
  config: SearchConfig,
  replacement: string
): string {
  const pattern = buildSearchPattern(config)
  if (!pattern) {
    return content
  }
  return content.replace(pattern, replacement)
}

export function replaceSingleMatch(
  content: string,
  match: MatchRange,
  replacement: string
): string {
  return content.slice(0, match.from) + replacement + content.slice(match.to)
}

export function replaceInProseMirror(
  view: EditorView,
  from: number,
  to: number,
  text: string
): ReplaceResult {
  if (!view) {
    return { success: false, error: 'Editor view not available' }
  }

  try {
    const { state } = view
    const tr = state.tr.replaceWith(from, to, state.schema.text(text))
    view.dispatch(tr)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export function replaceAllInProseMirror(
  view: EditorView,
  matches: MatchRange[],
  replaceWith: string
): ReplaceResult {
  if (!view) {
    return { success: false, error: 'Editor view not available' }
  }

  try {
    const { state } = view
    let tr = state.tr

    const sortedMatches = [...matches].sort((a, b) => b.from - a.from)

    for (const match of sortedMatches) {
      tr = tr.replaceWith(match.from, match.to, state.schema.text(replaceWith))
    }

    view.dispatch(tr)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export function getTextContent(doc: ProseMirrorNode): string {
  let text = ''
  doc.descendants((node) => {
    if (node.isText) {
      text += node.text
    } else if (node.isBlock) {
      text += '\n'
    }
  })
  return text.trim()
}
