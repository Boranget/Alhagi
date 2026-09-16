// ============================================================
// IScrollService — 滚动服务接口（Core Layer）
// ============================================================
//
// 定义编辑器滚动操作的抽象契约，供 Use Case 层依赖。
// 具体实现在 Adapters 层（ScrollServiceGateway）。
//
// 设计原则：
//   - 与具体编辑器（CodeMirror / ProseMirror）解耦
//   - 仅暴露滚动相关能力，不泄漏 DOM / 实现细节
//   - 支持打字机模式的光标居中滚动

export interface ScrollResult {
  /** 是否成功找到滚动容器 */
  containerFound: boolean
  /** 是否成功获取光标坐标 */
  cursorResolved: boolean
  /** 实际滚动的距离（px） */
  scrolledDistance: number
}

export interface IScrollService {
  /**
   * 将光标滚动到视口指定目标位置（打字机模式核心）。
   *
   * @param targetY - 光标目标 Y 坐标（距滚动容器顶部，px），默认 320
   * @param duration - 动画时长（ms），默认 100
   * @returns 滚动操作结果
   */
  scrollCursorToPosition(targetY?: number, duration?: number): ScrollResult

  /**
   * 获取当前光标在滚动容器内的 Y 坐标。
   * @returns 光标位置信息，若无法获取则返回 null
   */
  getCursorY(): { y: number; viewportY: number } | null

  /**
   * 启动打字机模式：注册 selectionchange 监听器，
   * 每次选择变化时自动将光标滚动到目标位置。
   */
  startTypewriterMode(): void

  /**
   * 停止打字机模式：移除 selectionchange 监听器。
   */
  stopTypewriterMode(): void
}
