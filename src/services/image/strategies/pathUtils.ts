export function isAbsolute(p: string): boolean {
  return /^[a-zA-Z]:[/\\]/.test(p) || p.startsWith('/')
}

export function basename(p: string, ext?: string): string {
  const name = p.replace(/\\/g, '/').split('/').pop() || ''
  if (ext && name.endsWith(ext)) {
    return name.slice(0, -ext.length)
  }
  return name
}

export function extname(p: string): string {
  const name = p.replace(/\\/g, '/').split('/').pop() || ''
  const dotIndex = name.lastIndexOf('.')
  return dotIndex > 0 ? name.slice(dotIndex) : ''
}

export function join(...parts: string[]): string {
  return parts
    .map((p, i) => {
      const normalized = p.replace(/\\/g, '/')
      if (i === 0) return normalized.replace(/\/+$/, '')
      if (i === parts.length - 1) return normalized.replace(/^\/+/, '')
      return normalized.replace(/^\/+|\/+$/g, '')
    })
    .filter(p => p.length > 0)
    .join('/')
}

export function resolve(from: string, to: string): string {
  if (isAbsolute(to)) {
    return to.replace(/\\/g, '/')
  }
  const fromDir = from.replace(/\\/g, '/').replace(/\/[^/]*$/, '')
  return join(fromDir, to)
}

export function normalizePath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  const result: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      if (result.length > 1 || (result.length === 1 && !/^[a-zA-Z]:$/.test(result[0]))) {
        result.pop()
      }
    } else {
      result.push(part)
    }
  }
  const prefix = /^[a-zA-Z]:/.test(p) ? '' : p.startsWith('/') ? '/' : ''
  return prefix + result.join('/')
}
