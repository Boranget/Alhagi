// ============================================================
// Strategy: copy-relative
// ============================================================
//
// 把图片写到「.md 文件旁边的子目录」，markdown 用相对路径引用。
// .md 未保存时退回到 temp 目录（saveAs 时 tabService.handleTempImagesOnSave 迁移）。
//
// userSetting (imageStoragePath) 的解读：
//   - 空 / undefined → 默认 FILE.DEFAULT_IMAGE_FOLDER
//   - 相对路径       → 作为 .md 旁边的子目录名（可含 {filename} 等变量）
//   - 绝对路径       → **拒绝**：copy-relative 模式不应产出 ../../ 绝对引用，
//                      回退到默认子目录并 console.warn

import type { ImageInsertContext, ImageInsertStrategy } from '../types'
import { FILE } from '@/constants'
import { getDirname, getRelativePath } from '@/utils/helpers'
import { saveTempImage } from '@/utils/tempImageManager'
import {
  isAbsolutePath,
  resolvePathVariables,
  generateImageName,
} from '../ImagePathResolver'
import { persistImage } from '../persist'
import { fileToBase64 } from '../persist'

export class CopyRelativeStrategy implements ImageInsertStrategy {
  readonly mode = 'copy-relative' as const

  async resolveFinalPath(ctx: ImageInsertContext): Promise<string> {
    const fileName = generateImageName(ctx.file)
    const subDir = this.resolveSubDir(ctx)

    // 未保存：把图片以「同样的子目录结构」写到 temp/<tabId>/<subDir>/<fileName>。
    // markdown 写入相对路径 `./<subDir>/<fileName>`，saveAs 时
    // tabService.handleTempImagesOnSave 把 temp/<tabId>/ 整体拷贝到 mdDir，
    // 子目录结构原样保留，markdown 路径无需重写。
    if (!ctx.tabFilePath) {
      const relativePath = `${subDir}/${fileName}`
      const base64 = await fileToBase64(ctx.file)
      await saveTempImage(ctx.tabId, relativePath, base64)
      return `./${relativePath}`
    }

    const mdDir = getDirname(ctx.tabFilePath)
    const targetDir = `${mdDir}/${subDir}`
    const absolutePath = `${targetDir}/${fileName}`
    await persistImage(ctx.file, absolutePath)
    const rel = getRelativePath(mdDir, absolutePath)
    // 严格 CommonMark 解析器要求相对路径以 ./ 或 ../ 开头，否则可能被识别为 URL scheme（如 `foo:bar`）。
    // 避免重复加前缀。
    return rel.startsWith('.') ? rel : `./${rel}`
  }

  /**
   * 计算「.md 旁边的子目录」名（已展开变量、剔除绝对路径用户设置）。
   * 不含 mdDir 前缀，便于未保存场景直接用作 temp 子路径。
   */
  private resolveSubDir(ctx: ImageInsertContext): string {
    const userSetting = ctx.storagePathTemplate
    let template: string

    if (!userSetting) {
      template = FILE.DEFAULT_IMAGE_FOLDER
    } else if (isAbsolutePath(userSetting)) {
      console.warn(
        `[copy-relative] imageStoragePath 是绝对路径 "${userSetting}"，` +
          `与「相对模式」语义冲突，已回退到默认 "${FILE.DEFAULT_IMAGE_FOLDER}"。` +
          `如需图片落到全局目录，请切到「复制到全局目录」模式。`
      )
      template = FILE.DEFAULT_IMAGE_FOLDER
    } else {
      template = userSetting
    }

    return resolvePathVariables(template, {
      fileName: ctx.file.name.replace(/\.[^.]+$/, ''),
      filePath: ctx.tabFilePath,
    })
  }
}
