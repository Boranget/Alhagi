// ============================================================
// ViewModeGateway — 视图模式副作用适配器（Adapters Layer）
// ============================================================

import type { IViewModeGateway } from '@core/domain/ports/gateways/IViewModeGateway'
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import { focusModePluginKey } from '@/plugins/focusModePlugin'
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
    this.findEditorRoot()?.classList.add(FOCUS_CLASS)
    this.dispatchFocusModeMeta(true)
  }

  disableFocusMode(): void {
    document.body.classList.remove(FOCUS_CLASS)
    this.findEditorRoot()?.classList.remove(FOCUS_CLASS)
    this.dispatchFocusModeMeta(false)
  }

  disableAll(): void {
    document.body.classList.remove(TYPEWRITER_CLASS, FOCUS_CLASS)
    this.findEditorRoot()?.classList.remove(FOCUS_CLASS)
    this.dispatchFocusModeMeta(false)
  }

  syncToActiveEditor(): void {
    const viewModeStore = useViewModeStore()
    this.dispatchFocusModeMeta(viewModeStore.focusMode)
  }

  private dispatchFocusModeMeta(enabled: boolean): void {
    const view = this.editorProvider?.getView()
    if (!view) return

    view.dispatch(view.state.tr.setMeta(focusModePluginKey, { enabled }))
  }

  private findEditorRoot(): HTMLElement | null {
    return (
      document.querySelector('.ProseMirror') ||
      document.querySelector('.crepe') ||
      document.querySelector('.cm-editor')
    )
  }
}
