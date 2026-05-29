/**
 * 表格操作命令
 */
import { findTableNode, findCurrentCell } from '@/utils/tableHelpers'
import type { EditorState } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'

/**
 * 插入表格行（在上方）
 */
export function insertTableRowAbove(state: EditorState, view: EditorView): boolean {
  const cellInfo = findCurrentCell(state)
  if (!cellInfo) return false

  const tableInfo = findTableNode(state)
  if (!tableInfo) return false

  const { node: tableNode, pos: tablePos } = tableInfo
  const { row } = cellInfo

  const firstRow = tableNode.child(0)
  const colCount = firstRow.childCount

  const newCells: Node[] = []
  for (let i = 0; i < colCount; i++) {
    const cellType = row === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell
    newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()))
  }
  const newRow = state.schema.nodes.table_row.create(null, newCells)

  let insertPos = tablePos + 1
  for (let i = 0; i < row; i++) {
    insertPos += tableNode.child(i).nodeSize
  }

  const tr = state.tr.insert(insertPos, newRow)
  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * 插入表格行（在下方）
 */
export function insertTableRowBelow(state: EditorState, view: EditorView): boolean {
  const cellInfo = findCurrentCell(state)
  if (!cellInfo) return false

  const tableInfo = findTableNode(state)
  if (!tableInfo) return false

  const { node: tableNode, pos: tablePos } = tableInfo
  const { row } = cellInfo

  const newCells: Node[] = []
  for (let i = 0; i < tableNode.child(0).childCount; i++) {
    newCells.push(state.schema.nodes.table_cell.create(null, state.schema.nodes.paragraph.create()))
  }
  const newRow = state.schema.nodes.table_row.create(null, newCells)

  let insertPos = tablePos + 1
  for (let i = 0; i <= row; i++) {
    insertPos += tableNode.child(i).nodeSize
  }

  const tr = state.tr.insert(insertPos, newRow)
  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * 删除表格行
 */
export function deleteTableRow(state: EditorState, view: EditorView): boolean {
  const { $from } = state.selection

  let tableNode: Node | null = null
  let tablePos = -1
  let rowNode: Node | null = null
  let rowPos = -1

  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table') {
      tableNode = node
      tablePos = $from.before(d)
      break
    }
  }

  if (!tableNode) return false

  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table_row' || node.type.name === 'table_header_row') {
      rowNode = node
      rowPos = $from.before(d)
      break
    }
  }

  if (!rowNode) return false

  if (tableNode.childCount <= 1) {
    const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize)
    view.dispatch(tr)
    view.focus()
    return true
  }

  const tr = state.tr.delete(rowPos, rowPos + rowNode.nodeSize)
  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * 插入表格列（在左侧）
 */
export function insertTableColumnLeft(state: EditorState, view: EditorView): boolean {
  const cellInfo = findCurrentCell(state)
  if (!cellInfo) return false

  const tableInfo = findTableNode(state)
  if (!tableInfo) return false

  const { node: tableNode, pos: tablePos } = tableInfo
  const { col } = cellInfo

  const newRows: Node[] = []
  for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
    const rowNode = tableNode.child(rowIdx)
    const newCells: Node[] = []

    for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
      if (cellIdx === col) {
        const cellType = rowIdx === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell
        newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()))
      }
      newCells.push(rowNode.child(cellIdx))
    }

    newRows.push(rowNode.type.create(rowNode.attrs, newCells))
  }

  const newTable = tableNode.type.create(tableNode.attrs, newRows)
  const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable)

  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * 插入表格列（在右侧）
 */
export function insertTableColumnRight(state: EditorState, view: EditorView): boolean {
  const cellInfo = findCurrentCell(state)
  if (!cellInfo) return false

  const tableInfo = findTableNode(state)
  if (!tableInfo) return false

  const { node: tableNode, pos: tablePos } = tableInfo
  const { col } = cellInfo

  const newRows: Node[] = []
  for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
    const rowNode = tableNode.child(rowIdx)
    const newCells: Node[] = []

    for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
      newCells.push(rowNode.child(cellIdx))
      if (cellIdx === col) {
        const cellType = rowIdx === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell
        newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()))
      }
    }

    newRows.push(rowNode.type.create(rowNode.attrs, newCells))
  }

  const newTable = tableNode.type.create(tableNode.attrs, newRows)
  const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable)

  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * 删除表格列
 */
export function deleteTableColumn(state: EditorState, view: EditorView): boolean {
  const { $from } = state.selection

  let tableNode: Node | null = null
  let tablePos = -1
  let rowNode: Node | null = null
  let colIndex = -1

  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table') {
      tableNode = node
      tablePos = $from.before(d)
      break
    }
  }

  if (!tableNode) return false

  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table_row' || node.type.name === 'table_header_row') {
      rowNode = node
      break
    }
  }

  if (!rowNode) return false

  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
      const cellPos = $from.before(d)
      for (let i = 0; i < rowNode.childCount; i++) {
        let calcPos = $from.before(d - 1) + 1
        for (let j = 0; j < i; j++) {
          calcPos += rowNode.child(j).nodeSize
        }
        if (calcPos === cellPos) {
          colIndex = i
          break
        }
      }
      break
    }
  }

  if (colIndex === -1) return false

  const colCount = rowNode.childCount

  if (colCount <= 1) {
    const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize)
    view.dispatch(tr)
    view.focus()
    return true
  }

  const newRows: Node[] = []
  for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
    const currentRowNode = tableNode.child(rowIdx)
    const newCells: Node[] = []

    for (let cellIdx = 0; cellIdx < currentRowNode.childCount; cellIdx++) {
      if (cellIdx !== colIndex) {
        newCells.push(currentRowNode.child(cellIdx))
      }
    }

    newRows.push(currentRowNode.type.create(currentRowNode.attrs, newCells))
  }

  const newTable = tableNode.type.create(tableNode.attrs, newRows)
  const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable)

  view.dispatch(tr)
  view.focus()
  return true
}
