/**
 * Frontmatter 结构约束插件
 *
 * 每次 doc 变化后扫一次顶层节点，保证：
 *   1. 文档中只允许 0 或 1 个 frontmatter；
 *   2. 唯一的 frontmatter 必须位于 doc 的首位（offset === 0）。
 *
 * 不满足时（拖拽 / 粘贴 / 撤销重做产生的脏状态）删除多余/错位的节点。
 * 不"挪到首位" —— 那会引入预期之外的内容覆盖；删除是最安全的修复。
 */

import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import type { Node } from '@milkdown/prose/model'

const frontmatterPositionKey = new PluginKey('frontmatter-position-guard')

export const frontmatterPositionPlugin = $prose(
  () =>
    new Plugin({
      key: frontmatterPositionKey,
      appendTransaction: (_trs, _oldState, newState) => {
        const frontmatterType = newState.schema.nodes['frontmatter']
        if (!frontmatterType) return null

        // 收集所有"位置不合法"的 frontmatter 节点（只看顶层）。
        const offenders: { pos: number; node: Node }[] = []
        let seenFirst = false
        newState.doc.forEach((node, offset) => {
          if (node.type !== frontmatterType) return
          // 第一个 frontmatter 在 offset 0 视为合法，跳过。
          if (!seenFirst && offset === 0) {
            seenFirst = true
            return
          }
          offenders.push({ pos: offset, node })
        })

        if (offenders.length === 0) return null

        // 从后往前删，避免 pos 偏移失效。
        const tr = newState.tr
        for (let i = offenders.length - 1; i >= 0; i--) {
          const { pos, node } = offenders[i]
          tr.delete(pos, pos + node.nodeSize)
        }
        return tr
      },
    })
)
