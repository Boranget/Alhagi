/**
 * Frontmatter 节点 schema
 *
 * YAML frontmatter（`---\n...\n---`）作为一等公民的 ProseMirror 节点：
 * 加载/保存全部走 AST，节点边界由 `defining` + `isolating` 在结构层保证，
 * `attrs.language` 为未来支持 toml/json frontmatter 留口。
 *
 * remark-frontmatter 解析出的 mdast `yaml` 节点（{type: 'yaml', value: '...'}）
 * 在 `parseMarkdown.runner` 直接收为本节点；序列化时反向回到 `yaml` 节点，
 * 由 mdast-util-frontmatter 统一加 `---` 起止符。
 */

import { $nodeSchema } from '@milkdown/utils'
import { expectDomTypeError } from '@milkdown/exception'

/** 当前唯一支持的 frontmatter 语言；扩展 toml/json 时改这里。 */
const FRONTMATTER_LANGUAGE = 'yaml'

export const frontmatterSchema = $nodeSchema('frontmatter', () => ({
  content: 'text*',
  marks: '',
  group: 'block',
  defining: true,
  isolating: true,
  // code: true 让 ProseMirror 把内部当作代码语义（不应用 mark、保留空白），
  // 与 codeBlockSchema 一致，配合 CodeMirror NodeView 体验最稳。
  code: true,
  attrs: {
    language: { default: FRONTMATTER_LANGUAGE, validate: 'string' },
  },
  parseDOM: [
    {
      tag: 'pre[data-frontmatter]',
      preserveWhitespace: 'full',
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom)
        // data-language 在 toDOM 里固定写出，但来自外部粘贴的 DOM 可能没有该属性，
        // 这里兜个默认值。
        return { language: dom.dataset.language ?? FRONTMATTER_LANGUAGE }
      },
    },
  ],
  toDOM: (node) => [
    'pre',
    { 'data-frontmatter': 'true', 'data-language': node.attrs.language },
    ['code', { 'data-language': node.attrs.language }, 0],
  ],
  parseMarkdown: {
    match: ({ type }) => type === 'yaml',
    runner: (state, node, type) => {
      const value = (node.value as string | undefined) ?? ''
      // 不显式传 attrs：schema 默认值 language='yaml' 即生效。
      state.openNode(type)
      if (value) state.addText(value)
      state.closeNode()
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'frontmatter',
    runner: (state, node) => {
      // mdast-util-frontmatter 的 yaml 节点：{type: 'yaml', value: string}
      // SerializerState.addNode(type, children, value) 第三个参数即是 mdast value。
      state.addNode('yaml', undefined, node.content.firstChild?.text ?? '')
    },
  },
}))
