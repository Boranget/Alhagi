// ============================================================
// ToggleFocusMode — 专注模式切换用例（Core Layer）
// ============================================================
//
// 职责：切换专注模式，并协调视觉副作用。
//
// 依赖注入：
//   - IViewModeGateway: 管理视图模式的视觉效果

import type { IViewModeGateway } from '@core/domain/ports/gateways/IViewModeGateway'

export class ToggleFocusMode {
  constructor(
    private viewModeGateway: IViewModeGateway
  ) {}

  /** 将专注模式设置为指定状态 */
  applyState(desiredState: boolean): void {
    if (desiredState) {
      this.viewModeGateway.enableFocusMode()
    } else {
      this.viewModeGateway.disableFocusMode()
    }
  }
}
