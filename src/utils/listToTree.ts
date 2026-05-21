/**
 * 将扁平标题列表转换为树形结构
 * 参考 MarkText 的 listToTree 实现
 */

import type { HeadingItem, HeadingTreeNode } from './headings'

class Node {
  parent: Node | null
  level: number | null
  label: string
  slug: string
  line: number
  children: Node[]

  constructor(item: { parent: Node | null; level: number | null; label: string; slug: string; line: number }) {
    this.parent = item.parent
    this.level = item.level
    this.label = item.label
    this.slug = item.slug
    this.line = item.line
    this.children = []
  }

  addChild(node: Node): void {
    this.children.push(node)
  }
}

function findParent(item: HeadingItem, lastNode: Node | null, rootNode: Node): Node {
  if (!lastNode) {
    return rootNode
  }
  const { level: lastLevel } = lastNode
  const { level } = item

  if (level < lastLevel!) {
    return findParent(item, lastNode.parent, rootNode)
  } else if (level === lastLevel) {
    return lastNode.parent!
  } else {
    return lastNode
  }
}

/**
 * 将扁平的标题列表转换为树形结构
 * @param list 扁平标题列表
 * @returns 树形标题节点数组
 */
export function listToTree(list: HeadingItem[]): HeadingTreeNode[] {
  if (list.length === 0) return []

  const rootNode = new Node({
    parent: null,
    level: null,
    label: '',
    slug: '',
    line: 0,
  })
  let lastNode: Node | null = null

  for (const item of list) {
    const parent = findParent(item, lastNode, rootNode)
    const node = new Node({
      parent,
      level: item.level,
      label: item.text,
      slug: item.slug,
      line: item.line,
    })
    parent.addChild(node)
    lastNode = node
  }

  return convertToTreeNode(rootNode.children)
}

function convertToTreeNode(nodes: Node[]): HeadingTreeNode[] {
  return nodes.map(node => ({
    label: node.label,
    slug: node.slug,
    level: node.level!,
    line: node.line,
    children: convertToTreeNode(node.children),
  }))
}

/**
 * 从扁平标题列表中获取在给定行之前的最近标题
 */
export function findNearestHeading(
  headings: HeadingItem[],
  targetLine: number
): HeadingItem | null {
  if (headings.length === 0) return null

  let nearest: HeadingItem | null = null
  for (const heading of headings) {
    if (heading.line <= targetLine) {
      nearest = heading
    } else {
      break
    }
  }
  return nearest
}