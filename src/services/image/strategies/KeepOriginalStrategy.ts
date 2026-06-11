// ============================================================
// Strategy: keep-original
// ============================================================
//
// 「保留原始路径」模式。语义按 originalUrl 的协议决定：
//
//   http(s)://...  → 直接保留为 markdown 引用（最纯的"保留原始"语义）
//   file:///...    → **不直接保留**：file:/// 是本机绝对路径，.md 一旦分享立刻 404。
//                    转而走 copy-absolute 把图片落本地全局目录，markdown 写本地绝对路径
//   无 URL         → 截图、拖拽本地文件等场景，无"原始路径"可保留 →
//                    走 copy-relative 兜底（图片落到 .md 旁边的子目录，至少能展示）
//
// 这一组分支保证：用户选 keep-original 后，
//   - 引用网图无副作用（最佳）
//   - 引用本机 file:/// 也不会传出未存在的路径
//   - 截图等场景仍能成功插入

import type { ImageInsertContext, ImageInsertStrategy } from '../types'
import { CopyRelativeStrategy } from './CopyRelativeStrategy'
import { CopyAbsoluteStrategy } from './CopyAbsoluteStrategy'

export class KeepOriginalStrategy implements ImageInsertStrategy {
  readonly mode = 'keep-original' as const

  private relativeFallback = new CopyRelativeStrategy()
  private absoluteFallback = new CopyAbsoluteStrategy()

  async resolveFinalPath(ctx: ImageInsertContext): Promise<string> {
    const url = ctx.originalUrl
    if (url && /^https?:\/\//i.test(url)) {
      return url
    }
    if (url && /^file:\/\//i.test(url)) {
      // file:/// 引用本机文件：保留路径会让 .md 不可分享；
      // 走绝对模式落到全局图片目录，markdown 写本地绝对路径
      return this.absoluteFallback.resolveFinalPath(ctx)
    }
    // 无 URL（截图 / 拖拽本地）：图片落到 .md 旁边
    return this.relativeFallback.resolveFinalPath(ctx)
  }
}
