// ============================================================
// ViewModeGateway — 视图模式副作用适配器（Adapters Layer）
// ============================================================

import type { IViewModeGateway } from '@core/interfaces/gateways/IViewModeGateway'

const TYPEWRITER_CLASS = 'typewriter-mode'
const FOCUS_CLASS = 'focus-mode'

export class ViewModeGateway implements IViewModeGateway {
  enableTypewriterMode(): void {
    document.body.classList.add(TYPEWRITER_CLASS)
  }

  disableTypewriterMode(): void {
    document.body.classList.remove(TYPEWRITER_CLASS)
  }

  enableFocusMode(): void {
    document.body.classList.add(FOCUS_CLASS)
  }

  disableFocusMode(): void {
    document.body.classList.remove(FOCUS_CLASS)
  }

  disableAll(): void {
    document.body.classList.remove(TYPEWRITER_CLASS, FOCUS_CLASS)
  }
}
