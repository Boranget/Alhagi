import { isAbsolute, join, normalizePath } from './pathUtils'

const FILE_URL_PREFIX = 'file:///'

export function toFileUrl(absolutePath: string): string {
  return FILE_URL_PREFIX + absolutePath.replace(/\\/g, '/')
}

export function isFileUrl(url: string): boolean {
  return url.startsWith(FILE_URL_PREFIX)
}

export function getFilePath(url: string): string {
  if (!isFileUrl(url)) return url
  return url.slice(FILE_URL_PREFIX.length)
}

export function computeRelative(from: string, to: string): string {
  const fromParts = normalizePath(from).split('/').filter(Boolean)
  const toParts = normalizePath(to).split('/').filter(Boolean)

  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++
  }

  const ups = fromParts.length - i
  const upsArray = Array(ups).fill('..')
  const downParts = toParts.slice(i)

  if (upsArray.length === 0) {
    return downParts.length > 0 ? `./${downParts.join('/')}` : '.'
  }
  return [...upsArray, ...downParts].join('/')
}

export function convertFileUrlsToRelative(markdown: string, fileDir: string): string {
  if (!fileDir) return markdown

  return markdown.replace(
    /\[([^\]]*)\]\(file:\/\/\/([^)]+)\)/g,
    (_match, alt: string, encodedPath: string) => {
      const absolutePath = decodeURIComponent(encodedPath)
      if (!isAbsolute(absolutePath)) return `[${alt}](file:///${encodedPath})`
      const rel = computeRelative(fileDir, absolutePath)
      return `[${alt}](${rel})`
    }
  )
}

export function convertRelativeToFileUrls(markdown: string, fileDir: string): string {
  if (!fileDir) return markdown

  return markdown.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt: string, url: string) => {
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('file://')) {
        return _match
      }
      const absolutePath = join(fileDir, url)
      return `[${alt}](${toFileUrl(absolutePath)})`
    }
  )
}
