import { visit } from 'unist-util-visit'
import type { Root, Yaml, Parent, Code, RootContent } from 'mdast'
import type { Plugin } from 'unified'

/**
 * Remark 插件：将 frontmatter YAML 节点转换为 yaml 代码块节点。
 *
 * remark-frontmatter 会将 `---\n...\n---` 解析为 {type: 'yaml', value: '...'} 节点。
 * 本插件将其转换为 {type: 'code', lang: 'yaml', value: '...'} 代码块节点，
 * 这样 Milkdown Crepe 的 CodeMirror 功能就能正确渲染 frontmatter。
 *
 * 需要在 remark-frontmatter 之后执行。
 */
const remarkFrontmatterToCode: Plugin<[], Root> = function () {
  return (tree) => {
    visit(tree, 'yaml', (node: Yaml, index: number | undefined, parent: Parent | undefined) => {
      if (index === undefined || !parent) return

      // 将 yaml 节点替换为 code block 节点
      const codeNode: Code = {
        type: 'code',
        lang: 'yaml',
        meta: null,
        value: node.value,
      }

      parent.children.splice(index, 1, codeNode as RootContent)
      return index + 1
    })
  }
}

export default remarkFrontmatterToCode
