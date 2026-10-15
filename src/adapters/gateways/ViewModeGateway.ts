// ============================================================
// ViewModeGateway — 视图模式副作用适配器（Adapters Layer）
// ============================================================

import type { IViewModeGateway } from '@core/domain/ports/gateways/IViewModeGateway'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import { useViewModeStore } from '@/stores/viewMode'

const TYPEWRITER_CLASS = 'typewriter-mode'
const FOCUS_CLASS = 'focus-mode'

export class ViewModeGateway implements IViewModeGateway {
  constructor(
    private editorProvider?: IEditorProvider
  ) {}

  enableTypewriterMode(): void {
    document.body.classList.add(TYPEWRITER_CLASS)
  }

  disableTypewriterMode(): void {
    document.body.classList.remove(TYPEWRITER_CLASS)
  }

  enableFocusMode(): void {
    document.body.classList.add(FOCUS_CLASS)
    this.editorProvider?.setEditorFocusMode(true)
  }

  disableFocusMode(): void {
    document.body.classList.remove(FOCUS_CLASS)
    this.editorProvider?.setEditorFocusMode(false)
  }

  disableAll(): void {
    document.body.classList.remove(TYPEWRITER_CLASS, FOCUS_CLASS)
    this.editorProvider?.setEditorFocusMode(false)
  }

  syncToActiveEditor(): void {
    const viewModeStore = useViewModeStore()
    this.editorProvider?.setEditorFocusMode(viewModeStore.focusMode)
  }
}
