import { $prose } from '@milkdown/kit/utils'
import { Plugin } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { ResolvedPos } from '@milkdown/kit/prose/model'

const FOCUS_MODE_ACTIVE_CLASS = 'focus-highlight'

/**
 * 找到当前光标所在的顶级块级节点（ProseMirror 的直接子元素）
 */
function findTopLevelBlock($pos: ResolvedPos) {
  let depth = $pos.depth
  
  // 找 depth === 1 的块级节点，即 ProseMirror 的直接子元素
  while (depth > 0) {
    const node = $pos.node(depth)
    if (node.isBlock && depth === 1) {
      return { node, start: $pos.before(depth), end: $pos.after(depth) }
    }
    depth--
  }
  
  return null
}

export const focusModePlugin = $prose(() => {
  return new Plugin({
    state: {
      init(_, state) {
        return DecorationSet.empty
      },
      apply(tr, oldState) {
        if (!tr.docChanged && !tr.selectionSet) {
          return oldState
        }

        const { selection } = tr
        const { $from } = selection
        
        const blockNode = findTopLevelBlock($from)
        
        if (!blockNode) {
          return DecorationSet.empty
        }

        return DecorationSet.create(tr.doc, [
          Decoration.node(blockNode.start, blockNode.end, {
            class: FOCUS_MODE_ACTIVE_CLASS
          })
        ])
      }
    },
    props: {
      decorations(state) {
        return this.getState(state)
      }
    }
  })
})