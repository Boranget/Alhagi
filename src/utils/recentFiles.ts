// ============================================================
// 最近文件：标题派生与历史数据修复
// ============================================================
//
// 最近文件是纯展示数据，唯一可信来源永远是 filePath：
//
//   title 只用于列表显示，绝不应该来自 tabId / 会话 id 等运行时标识。
//
// 历史上曾把 tabId（UUID）写进 title，导致持久化下来的条目全部显示
// 成一串 UUID。这里提供统一的派生 + 归一化逻辑：
//   - 新写入：由 filePath 取文件名；
//   - 读取旧数据：把错误的 title 就地纠正（不丢 pinned / lastOpened）。

import type { RecentFile } from '@/types'
import { extractTitleFromPath } from './helpers'

/** 从文件路径派生最近文件显示名。 */
export function deriveRecentFileTitle(filePath: string): string {
  if (!filePath) return ''
  return extractTitleFromPath(filePath) || filePath
}

/**
 * 修复最近文件列表：统一用 filePath 派生 title。
 *
 * 同时兼容极早期版本遗留的 `string[]`（只有路径没有对象结构）。
 * 无变化时返回原数组引用，调用方可用引用比较判断是否需要回写。
 */
export function normalizeRecentFiles(list: Array<RecentFile | string>): RecentFile[] {
  let changed = false

  const next = list.map((entry) => {
    // 兼容 string[]：升级成完整对象
    if (typeof entry === 'string') {
      changed = true
      const filePath = entry
      return { filePath, title: deriveRecentFileTitle(filePath), lastOpened: Date.now(), pinned: false }
    }

    const title = deriveRecentFileTitle(entry.filePath)
    if (entry.title === title) return entry

    changed = true
    return { ...entry, title }
  })

  return changed ? next : (list as RecentFile[])
}
