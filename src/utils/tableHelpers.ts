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
  
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    
    if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
      cellPos = $from.before(d)
      break
    }
    
    if (node.type.name === 'table_row' || node.type.name === 'table_header_row') {
      for (let i = 0; i < node.parent.childCount; i++) {
        if (node.parent.child(i) === node) {
          row = i
          break
        }
      }
    }
  }
  
  if (cellPos === -1) return null
  
  // 查找列索引
  let tableRow: Node | null = null
  let tableRowStart = 0
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table_row' || node.type.name === 'table_header_row') {
      tableRow = node
      tableRowStart = $from.start(d)
      break
    }
  }
  
  if (tableRow) {
    let pos = tableRowStart + 1
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
