import type { IEditorCommands } from '../IEditorCommands'

// ============================================================
// IEditorCommandSource — 编辑器命令供给端口
// ============================================================
//
// 命令实现（Milkdown 命令薄壳）是编辑器基础设施的内部细节，
// 适配器经此方法把 IEditorCommands 实例供给组合根；组合根与
// 用例不得伸手取原始 Crepe/editor 实例。

export interface IEditorCommandSource {
  getCommands(): IEditorCommands
}
