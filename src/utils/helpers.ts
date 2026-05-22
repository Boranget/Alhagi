export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function extractTitleFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  const filename = parts[parts.length - 1]
  return filename.replace(/\.md$/i, '') || '未命名'
}

export function extractTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1] : '未命名'
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function formatWordCount(count: number): string {
  if (count < 1000) {
    return count.toString()
  } else if (count < 10000) {
    return (count / 1000).toFixed(1) + 'k'
  } else {
    return (count / 10000).toFixed(1) + 'w'
  }
}

export function getDirname(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  parts.pop()
  return parts.join('/')
}

export function getRelativePath(from: string, to: string): string {
  const fromParts = from.split(/[/\\]/).filter(Boolean)
  const toParts = to.split(/[/\\]/).filter(Boolean)
  
  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i].toLowerCase() === toParts[i].toLowerCase()) {
    i++
  }
  
  const relativeParts: string[] = []
  for (let j = i; j < fromParts.length; j++) {
    relativeParts.push('..')
  }
  for (let j = i; j < toParts.length; j++) {
    relativeParts.push(toParts[j])
  }
  
  if (relativeParts.length === 0) {
    return '.'
  }
  
  return relativeParts.join('/')
}

/**
 * 规范化路径（处理 . 和 .. ）
 */
export function normalizePath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const result: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') {
      result.pop()
    } else {
      result.push(part)
    }
  }
  return result.join('/')
}

/**
 * 将 Markdown 图片 src 解析为可用于浏览器显示的 URL
 *
 * 核心设计原则：MD 内容原样存储，只在渲染时解析路径。
 *
 * 路径类型处理：
 *   https://... / http://...     → 直接使用（网络图片）
 *   file://...                   → 直接使用（已经是 file 协议）
 *   data:...                     → 直接使用（base64 内嵌）
 *   D:\path\... 或 /abs/path    → 绝对路径 → 添加 file:/// 前缀
 *   ./img.png 或 img.png 或 ../  → 相对路径 → 基于 MD 文件目录解析为绝对路径 → 添加 file:/// 前缀
 *
 * @param src - Markdown 中的图片 src（原样）
 * @param mdFilePath - 当前 MD 文件的绝对路径（用于解析相对路径）
 * @returns 可用于浏览器显示的 URL
 */
export function resolveImageToDisplayUrl(src: string, mdFilePath: string): string {
  // 网络 URL → 原样返回
  if (/^https?:\/\//.test(src)) return src

  // file:// 协议 → 原样返回
  if (src.startsWith('file://')) return src

  // data: URL → 原样返回
  if (src.startsWith('data:')) return src

  const normalized = src.replace(/\\/g, '/')

  // Windows 绝对路径：D:/path/image.png
  if (/^[A-Za-z]:[\\/]/.test(normalized)) {
    return 'file:///' + normalized
  }

  // Unix 绝对路径：/path/image.png
  if (normalized.startsWith('/')) {
    return 'file://' + normalized
  }

  // 相对路径 → 基于 MD 文件所在目录解析
  if (mdFilePath) {
    const mdDir = getDirname(mdFilePath)
    // 用 MD 文件目录作为 base，拼接相对路径后规范化
    const resolved = normalizePath(`${mdDir}/${normalized}`)
    const driveMatch = resolved.match(/^([A-Za-z]):/)
    if (driveMatch) {
      return 'file:///' + resolved
    }
    return 'file://' + resolved
  }

  // 无 MD 文件路径时，无法解析相对路径，返回原值
  return src
}
