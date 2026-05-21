/**
 * Markdown 标题解析工具
 * 从 Markdown 内容中提取标题，生成可用于大纲的结构化数据
 */

export interface HeadingItem {
  text: string
  level: number
  slug: string
  line: number
}

export interface HeadingTreeNode {
  label: string
  slug: string
  level: number
  line: number
  children: HeadingTreeNode[]
}

/**
 * 从文本生成 slug，用于标题锚点
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * 从 Markdown 内容中提取所有标题
 * 支持 ATX 风格（# 开头）和 Setext 风格（===/--- 下划线）
 */
export function parseHeadings(content: string): HeadingItem[] {
  const lines = content.split('\n')
  const headings: HeadingItem[] = []
  // 记录已处理的行，避免重复解析
  const usedLines = new Set<number>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // ATX 风格标题: # Heading
    const atxMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (atxMatch) {
      const level = atxMatch[1].length
      const text = atxMatch[2].trim()
      headings.push({
        text,
        level,
        slug: generateSlug(text),
        line: i + 1,
      })
      usedLines.add(i)
      continue
    }

    // Setext 风格标题: Heading followed by === or ---
    // 检查当前行是否为一组 === 或 ---（至少两个字符）
    const setextMatch = trimmed.match(/^(={2,}|-{2,})$/)
    if (setextMatch && i > 0) {
      const prevLine = lines[i - 1].trim()
      // 上一行不能是标题行，不能为空
      if (prevLine.length > 0 && !usedLines.has(i - 1)) {
        // 避免将 --- 匹配到 YAML front matter
        const level = setextMatch[1].startsWith('=') ? 1 : 2
        const text = prevLine.replace(/^#+\s*/, '').trim()
        if (text) {
          headings.push({
            text,
            level,
            slug: generateSlug(text),
            line: i + 1, // 使用下划线行作为定位
          })
          usedLines.add(i - 1)
          usedLines.add(i)
        }
      }
    }
  }

  return headings
}