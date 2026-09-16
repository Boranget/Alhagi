// ============================================================
// ToggleTypewriterMode — 打字机模式切换用例（Core Layer）
// ============================================================
//
// 职责：切换打字机模式，并协调所有副作用。
//
// 依赖注入：
//   - IScrollService: 控制打字机滚动行为的启停
//   - IViewModeGateway: 管理视图模式的视觉效果

import type { IScrollService } from '@core/interfaces/services/IScrollService'
import type { IViewModeGateway } from '@core/interfaces/gateways/IViewModeGateway'

export class ToggleTypewriterMode {
  constructor(
    private scrollService: IScrollService,
    private viewModeGateway: IViewModeGateway
  ) {}

  /** 将打字机模式设置为指定状态 */
  applyState(desiredState: boolean): void {
    if (desiredState) {
      this.viewModeGateway.enableTypewriterMode()
      this.scrollService.startTypewriterMode()
      this.scrollService.scrollCursorToPosition()
    } else {
      this.viewModeGateway.disableTypewriterMode()
      this.scrollService.stopTypewriterMode()
    }
  }
}
