// ============================================================
// IViewModeGateway — 视图模式副作用接口（Core Layer）
// ============================================================
//
// 封装打字机/专注模式的视觉副作用。
// Core 层只说"做什么"（意图），Adapters 层决定"怎么做"（CSS class）。
//
// 设计原则：
//   - 方法名表达业务意图，不暴露 CSS class 名
//   - Core 层无需知道 DOM / CSS 细节

export interface IViewModeGateway {
  /** 启用打字机模式的视觉效果 */
  enableTypewriterMode(): void
  /** 禁用打字机模式的视觉效果 */
  disableTypewriterMode(): void
  /** 启用专注模式的视觉效果 */
  enableFocusMode(): void
  /** 禁用专注模式的视觉效果 */
  disableFocusMode(): void
  /** 禁用所有视图模式的视觉效果 */
  disableAll(): void
  /** 将当前专注模式状态重新 dispatch 到新激活的编辑器（tab 切换后调用） */
  syncToActiveEditor(): void
}
