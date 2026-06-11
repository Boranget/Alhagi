// ============================================================
// Strategy: copy-absolute
// ============================================================
//
// 把图片写到全局/工作区/用户自定义绝对目录，markdown 用绝对路径引用。
//
// 目录解析（按优先级）：
//   1. userSetting 是绝对路径 → 直接用
//   2. userSetting 是相对路径 + 有 workspaceRoot → 拼到 workspace 下
//   3. userSetting 是相对路径 + 无 workspaceRoot → 拼到全局图片目录下
//      （`<Documents>/alhagi/images/`，对用户在文件管理器可见，不要塞进 cache）
//   4. userSetting 为空 → 直接用全局图片目录
//
// 然后用 ImagePathResolver 展开 {filename}/{date}/... 占位符。

import type { ImageInsertContext, ImageInsertStrategy } from '../types'
import { getGlobalImageStorageDir } from '@/utils/tempImageManager'
import {
  isAbsolutePath,
  resolvePathVariables,
  generateImageName,
} from '../ImagePathResolver'
import { persistImage } from '../persist'

export class CopyAbsoluteStrategy implements ImageInsertStrategy {
  readonly mode = 'copy-absolute' as const

  async resolveFinalPath(ctx: ImageInsertContext): Promise<string> {
    const targetDir = await this.resolveTargetDir(ctx)
    const fileName = generateImageName(ctx.file)
    const absolutePath = `${targetDir}/${fileName}`
    await persistImage(ctx.file, absolutePath)
    return absolutePath
  }

  private async resolveTargetDir(ctx: ImageInsertContext): Promise<string> {
    const userSetting = ctx.storagePathTemplate

    let raw: string
    if (!userSetting) {
      raw = await getGlobalImageStorageDir()
    } else if (isAbsolutePath(userSetting)) {
      raw = userSetting
    } else {
      const baseDir = ctx.workspaceRoot || (await getGlobalImageStorageDir())
      raw = `${baseDir}/${userSetting}`
    }

    return resolvePathVariables(raw, {
      fileName: ctx.file.name.replace(/\.[^.]+$/, ''),
      filePath: ctx.tabFilePath,
    })
  }
}
