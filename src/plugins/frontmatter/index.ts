/**
 * Frontmatter 一等公民插件
 *
 * 用专属 ProseMirror 节点表达 YAML frontmatter，加载/保存/输入三条链路全走 AST：
 *
 *  - 加载：remark-frontmatter → mdast `yaml` 节点 → schema.parseMarkdown → frontmatter 节点；
 *  - 保存：frontmatter 节点 → schema.toMarkdown → mdast `yaml` 节点 → remark-frontmatter
 *           → `---\n...\n---`；
 *  - 输入：用户在文档第一段敲 `---` → inputRule 创建 frontmatter 节点；其他位置让位 hr。
 *
 * 模块拆分：
 *   schema.ts          节点定义 + parse/toMarkdown
 *   nodeView.ts        CodeMirror 渲染（复用代码块视图）
 *   inputRule.ts       文档开头 --- 触发；其他位置让位 hr
 *   positionPlugin.ts  唯一 + 首位的结构约束
 *
 * Crepe 端只需 `.use(frontmatterFeature)` 就完整接通。
 */

import remarkFrontmatter from 'remark-frontmatter'
import { remarkPluginsCtx } from '@milkdown/core'
import type { MilkdownPlugin } from '@milkdown/ctx'

import { frontmatterSchema } from './schema'
import { frontmatterInputRule } from './inputRule'
import { frontmatterPositionPlugin } from './positionPlugin'
import { createFrontmatterNodeView } from './nodeView'

/**
 * 注册 remark-frontmatter。
 *
 * 时序细节：必须在 plugin 的 **同步 prepare 阶段** 直接 update remarkPluginsCtx，
 * 而不是 `await ctx.wait(InitReady)` 之后再 update —— 因为内部 `schema` plugin
 * 的 runner 也等 InitReady，等到后会把当前 remarkPluginsCtx 一次性 reduce 进
 * remark processor。两个 await 跑在同一个 Promise 队列里，谁先谁后不可控；如果
 * register 比 schema runner 晚一拍执行，remark-frontmatter 就没接到 processor 上，
 * 文档开头的 `---` 会被 mdast 解析为 setext heading / thematic break。
 *
 * prepare 阶段是同步的，发生在所有 runner 之前；这时 init plugin 已经 inject 过
 * remarkPluginsCtx 的默认值（[]），可以安全 update。
 *
 * `as typeof rp`：把整个新数组的字面量类型 narrow 回 `rp` 元素类型。
 * remark-frontmatter 的 options 类型（Matter | Preset[]）与 Milkdown 的
 * `RemarkPlugin<Record<string, unknown>>` 不严格兼容，但运行时是 unified
 * 统一接受的 plugin 形态。
 */
const remarkFrontmatterRegister: MilkdownPlugin = (ctx) => {
  ctx.update(remarkPluginsCtx, (rp) => [
    ...rp,
    { plugin: remarkFrontmatter, options: { type: 'yaml', marker: '-' } },
  ] as typeof rp)
  // 仍需返回 runner 以满足 MilkdownPlugin 签名；不依赖任何 timer。
  return async () => {}
}

/**
 * `$nodeSchema` 返回的 frontmatterSchema 是 `[schemaCtx, $Node]` 元组（外加附属
 * 属性），需要展开成两个独立 plugin —— 因此整个数组用 `.flat()` 平铺。
 */
export const frontmatterFeature: MilkdownPlugin[] = [
  remarkFrontmatterRegister,
  frontmatterSchema,
  createFrontmatterNodeView(),
  frontmatterInputRule,
  frontmatterPositionPlugin,
].flat()
