// ============================================================
// IEditorProvider — 编辑器只读查询接口（Core Layer）
// ============================================================
//
// 提供滚动服务所需的编辑器只读查询能力。
// 与 IEditorService（完整编辑器生命周期）解耦，
// 遵循接口隔离原则（ISP）：消费者仅依赖所需能力。
//
// 为什么不用 IEditorService？
//   - ScrollServiceGateway 只需要 getActiveEditor() 和 getView()
//   - 依赖完整 IEditorService 会引入不必要的耦合
//   - IEditorProvider 可以被任何需要"查询编辑器状态"的场景复用

/** ProseMirror EditorView 的最小只读接口 */
export interface ProseMirrorView {
  coordsAtPos(pos: number): { top: number; bottom: number; left: number; right: number } | null
  state: {
    selection: {
      from: number
      to: number
    }
  }
}

export interface IEditorProvider {
  /** 获取当前活跃编辑器类型 */
  getActiveEditor(): 'crepe' | 'codemirror' | null

  /** 获取 ProseMirror EditorView 实例（Crepe 模式下可用） */
  getView(): ProseMirrorView | null
}
