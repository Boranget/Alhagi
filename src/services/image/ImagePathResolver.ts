// ============================================================
// Alhagi Image Path Resolver - 路径变量与目录解析（无 IO）
// ============================================================
//
// 把路径模板（含 {filename}/{filedir}/{date}/{time}/{datetime}）展开为具体路径。
// 抽到独立模块便于单测，不依赖 Pinia/Electron API。

import { getDirname } from '@/utils/helpers'

interface PathContext {
  fileName?: string
  filePath?: string
  now?: Date
}

/** 渲染端的"绝对路径"判定：盘符 (Win) 或 / 开头 (POSIX) */
export function isAbsolutePath(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('/')
}

/** 把模板里的 {variable} 占位符替换为实际值，时间以 ISO 日期表示 */
export function resolvePathVariables(template: string, ctx: PathContext = {}): string {
  const fileName = ctx.fileName ?? 'image'
  const fileDir = ctx.filePath ? getDirname(ctx.filePath) : ''
  const now = ctx.now ?? new Date()
  const date = now.toISOString().split('T')[0]
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-')
  const datetime = `${date}-${time}`

  return template
    .replace(/\{filename\}/gi, fileName)
    .replace(/\{filedir\}/gi, fileDir)
    .replace(/\{date\}/gi, date)
    .replace(/\{time\}/gi, time)
    .replace(/\{datetime\}/gi, datetime)
}

/**
 * 生成防碰撞文件名。规则：
 *   - `foo.png`        → `<ts>_foo.png`
 *   - `archive.tar.gz` → `<ts>_archive.tar.gz`（取最后一段为扩展名）
 *   - `README`         → `<ts>_README`（无扩展名时不补，避免产生 `.README` 双后缀）
 */
export function generateImageName(file: File): string {
  const lastDot = file.name.lastIndexOf('.')
  // lastDot === 0 视为隐藏文件（如 `.gitignore`），不当扩展名
  if (lastDot <= 0) {
    return `${Date.now()}_${file.name}`
  }
  const nameWithoutExt = file.name.slice(0, lastDot)
  const extension = file.name.slice(lastDot + 1)
  return `${Date.now()}_${nameWithoutExt}.${extension}`
}
