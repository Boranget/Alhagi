import { visit } from 'unist-util-visit'
import type { Root, Text, Parent, PhrasingContent } from 'mdast'
import type { Plugin } from 'unified'

/**
 * Remark plugin to parse ^text^ as superscript and ~text~ as subscript nodes.
 * Note: GFM strikethrough uses ~~double~~ tilde, so single ~ is safe for subscript.
 */
const remarkSuperSub: Plugin<[], Root> = function () {
  return (tree) => {
    // Process <[SILENT_never_used_51bce0c785ca2f68081bfa7d91973934]> ^text^
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || !parent) return

      const value = node.value
      const re = /\^([^^\n]+)\^/g
      const parts: (Text | Parent)[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = re.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: value.slice(lastIndex, match.index) })
        }
        parts.push({
          type: 'superscript',
          children: [{ type: 'text', value: match[1] }],
        } as Parent)
        lastIndex = match.index + match[0].length
      }

      if (parts.length === 0) return

      if (lastIndex < value.length) {
        parts.push({ type: 'text', value: value.slice(lastIndex) })
      }

      parent.children.splice(index, 1, ...(parts as unknown as PhrasingContent[]))
      return index + parts.length
    })

    // Process subscript: ~text~ (single tilde, not double)
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || !parent) return

      const value = node.value
      // Match single ~ but not ~~ (negative lookahead/lookbehind)
      const re = /(?<!~)~([^~\n]+)~(?!~)/g
      const parts: (Text | Parent)[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = re.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: value.slice(lastIndex, match.index) })
        }
        parts.push({
          type: 'subscript',
          children: [{ type: 'text', value: match[1] }],
        } as Parent)
        lastIndex = match.index + match[0].length
      }

      if (parts.length === 0) return

      if (lastIndex < value.length) {
        parts.push({ type: 'text', value: value.slice(lastIndex) })
      }

      parent.children.splice(index, 1, ...(parts as unknown as PhrasingContent[]))
      return index + parts.length
    })
  }
}

export default remarkSuperSub
