// ============================================================
// Alhagi 共享类型定义
// ============================================================

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  expanded?: boolean
  isDirty?: boolean
}

export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size: number
  lastModified: number
}

export interface RecentFile {
  filePath: string
  title: string
  lastOpened: number
  pinned: boolean
}

export interface RecentFolder {
  folderPath: string
  name: string
  lastOpened: number
  pinned: boolean
}

export interface SearchResult {
  filePath: string
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

export interface SearchOptions {
  includePatterns?: string[]
  excludePatterns?: string[]
  caseSensitive?: boolean
  wholeWord?: boolean
  useRegex?: boolean
}

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

export interface DetachedTabData {
  id: string
  title: string
  content: string
  filePath: string | null
  isDirty: boolean
  viewMode: string
  cursor: { from: number; to: number }
}

// ========== 文件类型常量 ==========
export const FILE_TYPES = {
  FILE: 'file',
  DIRECTORY: 'directory',
} as const

// ========== 行尾符常量 ==========
export const LINE_ENDINGS = {
  LF: '\n',
  CRLF: '\r\n',
} as const

export type LineEnding = keyof typeof LINE_ENDINGS

/**
 * 转换文本的行尾符为目标格式
 */
export function convertLineEndings(content: string, lineEnding: LineEnding): string {
  const targetEnding = LINE_ENDINGS[lineEnding]
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, targetEnding)
}
