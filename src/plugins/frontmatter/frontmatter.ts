/**
 * Frontmatter 双向转换工具函数
 *
 * 将 YAML frontmatter（---\n...\n---）转换为 yaml 代码块（```yaml\n...\n```），
 * 以便在 Milkdown Crepe 编辑器中正确显示和编辑，保存时再转回 frontmatter 格式。
 *
 * 设计思路参考 Markbun 的最佳实践方案，避免使用 @milkdown/plugin-frontmatter
 * （该插件在 Milkdown 7.x 中存在序列化错误）。
 */

/**
 * 将 frontmatter 转换为 yaml 代码块用于编辑器显示。
 * `---\ncontent\n---` → ```yaml\ncontent\n```
 *
 * 仅在文档开头匹配，不影响正文中的分隔线。
 */
export function convertFrontmatterToCodeBlock(markdown: string): string {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/
  const match = markdown.match(frontmatterRegex)

  if (match) {
    const frontmatter = match[1]
    const content = markdown.slice(match[0].length)
    return '```yaml\n' + frontmatter + '\n```\n' + content
  }

  return markdown
}

/**
 * 将 yaml 代码块转回 frontmatter 用于保存。
 * ```yaml\ncontent\n``` → `---\ncontent\n---`
 *
 * `^` 锚点确保只转换文档开头的 yaml 代码块，避免影响正文中的 yaml 代码块。
 */
export function convertCodeBlockToFrontmatter(markdown: string): string {
  // 只匹配文档开头的 yaml 代码块
  const codeBlockRegex = /^```yaml\s*\n([\s\S]*?)\n```\s*(?:\n|$)/
  const match = markdown.match(codeBlockRegex)

  if (match) {
    const frontmatter = match[1]
    const content = markdown.slice(match[0].length)
    // 确保 frontmatter 以换行结尾
    const normalizedFrontmatter = frontmatter.endsWith('\n')
      ? frontmatter
      : frontmatter + '\n'
    return '---\n' + normalizedFrontmatter + '---\n\n' + content
  }

  return markdown
}

/**
 * 检查 markdown 内容是否包含 frontmatter。
 */
export function hasFrontmatter(markdown: string): boolean {
  return /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.test(markdown)
}
