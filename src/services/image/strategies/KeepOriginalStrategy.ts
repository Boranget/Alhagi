// ============================================================
// Strategy: keep-original
// ============================================================
//
// 「保留原始路径」模式。当前架构下的实际行为：
//
//   - 网图复制（剪贴板含 text/html + <img src="https://...">）：
//       不进入本策略。Crepe upload plugin 看到 text/html 直接 return false 放行，
//       ProseMirror 默认 paste parser 解析 <img> 标签，直接以 https URL 插入节点。
//       效果 ≈ "保留原始 URL"，符合模式名预期。
//   - 截图 / 拖拽本地文件 / 文件选择对话框：
//       无 originalUrl 可保留 → 回退到 CopyRelativeStrategy 写到 .md 旁边。
//   - originalUrl 含 file:///（罕见场景）：
//       本机绝对路径，分享 .md 会 404 → 走 CopyAbsoluteStrategy 落本地全局目录。
//
// 注意：originalUrl 当前**没有调用方传入**，下面 http(s)/file:/// 两条分支是
// 防御性预留，等将来有路径让 uploader 拿到 url 时直接生效（参考 ImageInsertContext.originalUrl）。
// 当前实际触发路径只走最后一条 relativeFallback。

import type { ImageInsertContext, ImageInsertStrategy } from '../types'
import { CopyRelativeStrategy } from './CopyRelativeStrategy'
import { CopyAbsoluteStrategy } from './CopyAbsoluteStrategy'

export class KeepOriginalStrategy implements ImageInsertStrategy {
  readonly mode = 'keep-original' as const

  private relativeFallback = new CopyRelativeStrategy()
  private absoluteFallback = new CopyAbsoluteStrategy()

  async resolveFinalPath(ctx: ImageInsertContext): Promise<string> {
    const url = ctx.originalUrl
    if (url && /^https?:\/\//i.test(url)) return url
    if (url && /^file:\/\//i.test(url)) {
      return this.absoluteFallback.resolveFinalPath(ctx)
    }
    return this.relativeFallback.resolveFinalPath(ctx)
  }
}
