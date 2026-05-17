import { EditorView } from '@milkdown/prose/view'
import { Node as ProseMirrorNode } from '@milkdown/prose/model'

export interface ReplaceResult {
  success: boolean
  newContent?: string
  error?: string
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
  matches: Array<{ from: number; to: number }>,
  replaceWith: string
): ReplaceResult {
  if (!view) {
    return { success: false, error: 'Editor view not available' }
  }

  try {
    const { state } = view
    let tr = state.tr

    // 从后往前替换，避免位置偏移问题
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

export function findMatchesInDocument(
  doc: ProseMirrorNode,
  pattern: RegExp
): Array<{ from: number; to: number; text: string }> {
  const matches: Array<{ from: number; to: number; text: string }> = []

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

