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
