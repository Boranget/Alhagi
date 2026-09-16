import { basename, extname } from './pathUtils'

export interface PathTemplateContext {
  fileName?: string
  fileDir?: string
  date?: Date
}

export class PathTemplate {
  private static readonly VARIABLE_PATTERN = /\{(\w+)\}/g

  static expand(template: string, context: PathTemplateContext): string {
    const now = context.date || new Date()

    return template.replace(this.VARIABLE_PATTERN, (match, variable) => {
      switch (variable) {
        case 'filename':
          return context.fileName || 'untitled'
        case 'filedir':
          return context.fileDir || ''
        case 'date':
          return this.formatDate(now)
        case 'time':
          return this.formatTime(now)
        case 'datetime':
          return `${this.formatDate(now)}-${this.formatTime(now)}`
        default:
          return match
      }
    })
  }

  static getAvailableVariables(): string[] {
    return ['filename', 'filedir', 'date', 'time', 'datetime']
  }

  static getVariableDescriptions(): Record<string, string> {
    return {
      filename: '当前文档名（无扩展名）',
      filedir: '当前文档目录名',
      date: '当前日期 (YYYYMMDD)',
      time: '当前时间 (HHmmss)',
      datetime: '日期+时间 (YYYYMMDD-HHmmss)',
    }
  }

  private static formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  }

  private static formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${hours}${minutes}${seconds}`
  }

  static resolveImageFileName(sourceFileName: string, template?: string): string {
    if (!template) {
      return sourceFileName
    }

    const ext = extname(sourceFileName)
    const baseName = basename(sourceFileName, ext)
    const expanded = this.expand(template, { fileName: baseName })

    if (!extname(expanded)) {
      return `${expanded}${ext}`
    }

    return expanded
  }

  static toRelativePath(fullPath: string, basePath: string): string {
    const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/$/, '')
    const normalizedFull = fullPath.replace(/\\/g, '/')

    if (normalizedFull.startsWith(normalizedBase)) {
      const relative = normalizedFull.substring(normalizedBase.length)
      return relative.startsWith('/') ? `.${relative}` : `./${relative}`
    }

    return fullPath
  }
}
