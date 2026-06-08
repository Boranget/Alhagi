import { $command } from '@milkdown/utils'
import { wrapIn } from '@milkdown/prose/commands'
import { bulletListSchema, listItemSchema } from '@milkdown/preset-commonmark'
import type { EditorState, Transaction } from '@milkdown/prose/state'

export const toggleTaskListCommand = $command(
  'ToggleTaskList',
  (ctx) => () => {
    const bulletListType = bulletListSchema.type(ctx)
    const listItemType = listItemSchema.type(ctx)

    const toggleTaskList = (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
      const { tr, selection, doc } = state
      const { from } = selection

      const startPos = doc.resolve(from)
      let depth = startPos.depth
      let listItemNode = startPos.node(depth)

      while (depth >= 0 && listItemNode.type.name !== 'list_item') {
        depth--
        if (depth >= 0) {
          listItemNode = startPos.node(depth)
        }
      }

      if (depth < 0 || listItemNode.type.name !== 'list_item') {
        const bulletListResult = wrapIn(bulletListType)(state)
        if (!bulletListResult) return false

        if (dispatch) {
          const newTr = state.tr
          bulletListResult.apply()

          const newDoc = newTr.doc || doc
          const newStartPos = newDoc.resolve(from)

          let newDepth = newStartPos.depth
          let newListItem = newStartPos.node(newDepth)
          while (newDepth >= 0 && newListItem.type.name !== 'list_item') {
            newDepth--
            if (newDepth >= 0) {
              newListItem = newStartPos.node(newDepth)
            }
          }

          if (newDepth >= 0) {
            const listItemStart = newStartPos.before(newDepth + 1)
            newTr.setNodeMarkup(listItemStart, listItemType, {
              ...newListItem.attrs,
              checked: false,
            })
          }
          dispatch(newTr)
        }
        return true
      }

      const currentChecked = listItemNode.attrs.checked as boolean | null
      const newChecked = currentChecked === null ? false : currentChecked === false ? true : null

      if (dispatch) {
        const listItemStart = startPos.before(depth + 1)
        tr.setNodeMarkup(listItemStart, listItemType, {
          ...listItemNode.attrs,
          checked: newChecked,
        })
        dispatch(tr)
      }

      return true
    }

    return toggleTaskList
  }
)