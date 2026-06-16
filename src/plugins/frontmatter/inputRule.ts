/**
 * Frontmatter InputRule
 *
 * "在文档第一段输入 `---`" → 把整段替换成空 frontmatter 节点。
 * 其他位置一律 return null，让 prosemirror-inputrules 链路继续 ——
 * 那时 preset-commonmark 的 `insertHrInputRule` 接管，正常生成 hr。
 *
 * 注册顺序：customInputRules.run() 命中即停，本规则必须排在 hr 规则前面。
 * preset-commonmark 用 `$inputRule` 注册 hr，会在它的 runner 阶段把规则
 * push 到 `inputRulesCtx` 末尾；本插件在 runner 阶段手动 unshift 到列表头部，
 * 保证命中顺序：frontmatter > hr。
 */

import { InitReady, inputRulesCtx } from '@milkdown/core'
import type { MilkdownPlugin } from '@milkdown/ctx'
import { InputRule } from 'prosemirror-inputrules'

import { frontmatterSchema } from './schema'

export const frontmatterInputRule: MilkdownPlugin = (ctx) => async () => {
  await ctx.wait(InitReady)

  const rule = new InputRule(/^---$/, (state) => {
    const { $from } = state.selection

    // 必须在文档顶层（depth=1：当前节点直接挂在 doc 下）。
    if ($from.depth !== 1) return null
    // 必须是文档第一个 block：父在 doc 中的起始偏移为 0。
    if ($from.before(1) !== 0) return null
    // 当前块必须是普通 paragraph —— 已在代码块/标题里就让出。
    // （customInputRules.run 在 code 节点本就不触发，这里加一层防御。）
    if ($from.parent.type.name !== 'paragraph') return null
    // 段落里只能有 "--"：第三个 '-' 是正在输入的字符，textContent 此时
    // 只反映已落地的两个 '-'。多一个字符就让位给 hr。
    if ($from.parent.textContent !== '--') return null

    const node = frontmatterSchema.type(ctx).createAndFill()
    if (!node) return null

    // 把第一段连同其前后边界整段吃掉，替成 frontmatter 节点。
    return state.tr.replaceRangeWith($from.before(), $from.after(), node)
  })

  ctx.update(inputRulesCtx, (rules) => [rule, ...rules])

  return () => {
    ctx.update(inputRulesCtx, (rules) => rules.filter((r) => r !== rule))
  }
}
