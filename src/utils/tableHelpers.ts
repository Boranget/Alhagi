/**
 * 表格操作辅助函数
 */
import type { EditorState } from '@milkdown/kit/prose/state'
import type { Node } from '@milkdown/kit/prose/model'

export interface CellInfo {
  row: number
  col: number
  pos: number
}

export interface TableInfo {
  node: Node
  pos: number
}

/**
 * 查找当前单元格信息
 */
export function findCurrentCell(state: EditorState): CellInfo | null {
  const { $from } = state.selection

  let row = 0
  let col = 0
  let cellPos = -1
  let rowDepth = -1

  // 第一遍：找单元格起始位置 + 记录所在行的 depth（用于后续在表格层定位行号）
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)

    if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
      cellPos = $from.before(d)
    }

    if ((node.type.name === 'table_row' || node.type.name === 'table_header_row') && rowDepth === -1) {
      rowDepth = d
    }
  }

  if (cellPos === -1) return null

  // 第二遍：通过 $from 在表格层（rowDepth - 1）取行的索引（ProseMirror Node 没有 parent，
  // 但通过 ResolvedPos.index(depth) 可以取该 depth 下当前节点在父节点中的位置）
  if (rowDepth > 0) {
    row = $from.index(rowDepth - 1)
  }

  // 查找列索引：在行节点内按 cellPos 落入哪个 cell 决定列号
  if (rowDepth > 0) {
    const tableRow = $from.node(rowDepth)
    const tableRowStart = $from.start(rowDepth)
    let pos = tableRowStart
    for (let i = 0; i < tableRow.childCount; i++) {
      const cell = tableRow.child(i)
      if (cellPos >= pos && cellPos < pos + cell.nodeSize) {
        col = i
        break
      }
      pos += cell.nodeSize
    }
  }

  return { row, col, pos: cellPos }
}

/**
 * 查找表格节点
 */
export function findTableNode(state: EditorState): TableInfo | null {
  const { $from } = state.selection
  
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    
    if (node.type.name === 'table') {
      return {
        node,
        pos: $from.before(d),
      }
    }
  }
  
  return null
}
