// ============================================================
// historySide — 命令驱动 undo/redo 的目标编辑器侧
// ============================================================
//
// 键盘 Ctrl+Z 由 keybinding 层放行给「当前聚焦」的编辑器原生历史；
// 命令/菜单驱动的 edit:undo 走这里，两者必须给出一致的答案：
//
//   source  → CM（PM 不可见）
//   wysiwyg → Crepe（CM 不可见）
//   split   → 当前焦点所在侧；焦点已被菜单等夺走时退回最后聚焦侧
//
// 分派策略只此一处，避免再出现「按 viewMode 硬分派」与键盘行为打架。

export type HistorySide = 'crepe' | 'cm'

export interface HistorySideInput {
  viewMode: 'wysiwyg' | 'source' | 'split'
  /** document.activeElement 是否落在 CM 的 DOM 内 */
  activeInCM: boolean
  /** document.activeElement 是否落在 ProseMirror 的 DOM 内 */
  activeInCrepe: boolean
  /** 该 tab 内最后一次获得焦点的一侧（菜单夺焦后的行为依据） */
  lastFocused: HistorySide | null
}

export function resolveHistorySide(input: HistorySideInput): HistorySide {
  if (input.viewMode === 'source') return 'cm'
  if (input.viewMode === 'wysiwyg') return 'crepe'
  if (input.activeInCM) return 'cm'
  if (input.activeInCrepe) return 'crepe'
  return input.lastFocused ?? 'crepe'
}
