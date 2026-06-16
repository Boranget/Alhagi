/**
 * Frontmatter 节点视图
 *
 * 复用 CustomCodeMirrorBlock：frontmatter 在结构上是独立节点类型，
 * 但渲染层就是一个锁定 yaml 语言的 CodeMirror 视图。
 *
 * 与 customCodeMirrorPlugin 的关系：
 * - customCodeMirrorPlugin 绑定 codeBlockSchema（正文 ` ``` ` 代码块），
 *   并在 runner 中 ctx.update(codeBlockConfig.key) 注入 languages + extensions；
 * - 本插件绑定 frontmatterSchema，从 codeBlockConfig 读注入后的配置构造 NodeView；
 * - 两者共享同一份 codeBlockConfig，避免双向覆盖。
 *
 * 兜底：当 customCodeMirrorPlugin 未启用时（alhagi 项目里 crepeEditorManager
 * 始终一并 use 两个插件，但作为独立插件保留容错），用本地构造的 extensions。
 */

import { languages } from '@codemirror/language-data'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { basicSetup } from 'codemirror'

import { codeBlockConfig } from '@milkdown/kit/component/code-block'
import { $view } from '@milkdown/utils'
import type { Ctx } from '@milkdown/ctx'
import type { Node as ProseNode } from '@milkdown/prose/model'
import type { EditorView } from '@milkdown/prose/view'

import { CustomCodeMirrorBlock } from '@/components/Editor/codemirror/CustomCodeMirrorBlock'
import { LanguageLoader } from '@/components/Editor/codemirror/loader'

import { frontmatterSchema } from './schema'

/**
 * Fallback CodeMirror extensions —— 与 customCodeMirrorPlugin.ts 保持一致，
 * 在仅启用 frontmatter 插件而未启用代码块插件的场景下兜底。
 */
const FALLBACK_EXTENSIONS: Extension[] = [
  keymap.of(defaultKeymap.concat(indentWithTab)),
  basicSetup,
]

export function createFrontmatterNodeView() {
  // 让所有 frontmatter NodeView 共用同一个 LanguageLoader（共享语言加载缓存）。
  let sharedLoader: LanguageLoader | null = null

  return $view(frontmatterSchema.node, (ctx: Ctx) => {
    const baseConfig = ctx.get(codeBlockConfig.key)
    // 正常路径：customCodeMirrorPlugin 已注入 extensions 和 languages。
    // 兜底路径：用 FALLBACK_EXTENSIONS + @codemirror/language-data 全集。
    const hasInjected = !!baseConfig.extensions?.length
    const finalConfig = hasInjected
      ? baseConfig
      : { ...baseConfig, extensions: FALLBACK_EXTENSIONS }
    const loaderLanguages = hasInjected ? baseConfig.languages : languages

    return (node: ProseNode, view: EditorView, getPos: () => number | undefined) => {
      // baseConfig 不携带 LanguageLoader（它是 NodeView 内部细节），自己造一个并复用。
      sharedLoader ??= new LanguageLoader(loaderLanguages)
      // CustomCodeMirrorBlock 根据 node.attrs.language 决定语法高亮 ——
      // schema 里 language 默认 'yaml'，无需特殊处理。
      return new CustomCodeMirrorBlock(node, view, getPos, sharedLoader, finalConfig)
    }
  })
}
