// ============================================================
// 大文档判定
// ============================================================
//
// Crepe / ProseMirror 的 WYSIWYG 渲染需要为文档中的每个节点创建 DOM。
// 文档达到数 MB 时，完整解析 + 建树会让渲染进程阻塞数秒甚至更久，
// 表现为「打开大文件后编辑器卡死」。
//
// 这里提供统一的阈值判定：命中大文档时由 EditorPool 跳过 Crepe 实例，
// 只创建 CodeMirror（虚拟化视口）并以 source 模式打开。
//
// 注意：fileType 是否走 markdown 链路由调用方判断（text viewer 不走 Crepe，
// 不受此阈值影响）。

import { EDITOR } from '@/constants'

/** 内容是否超过 WYSIWYG 安全阈值。null/undefined 视为普通文档。 */
export function isLargeDocumentContent(content: string | null | undefined): boolean {
  return (content?.length ?? 0) > EDITOR.LARGE_DOCUMENT_THRESHOLD
}

/**
 * 统计非空白字符数（UTF-16 code unit）。
 *
 * 状态栏字数统计原先用 `content.replace(/\s/g, '')`，会为 MB 级文档
 * 再分配一份同样大的字符串；这里用一次线性扫描替代，供大文档分支使用。
 */
export function countNonWhitespaceCharacters(content: string): number {
  let count = 0
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i)
    // 空格 / 制表 / 换行 / 回车 / 垂直制表 / 换页 / NBSP
    if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d && code !== 0x0b && code !== 0x0c && code !== 0xa0) {
      count++
    }
  }
  return count
}
