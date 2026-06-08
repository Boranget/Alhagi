import type { EditorView } from '@milkdown/kit/prose/view'
import { TextSelection } from '@milkdown/kit/prose/state'

export class EditorStateManager {
  private view: EditorView | null = null

  attach(view: EditorView): void {
    this.view = view
  }

  detach(): void {
    this.view = null
  }

  getCurrentState(): { cursor?: { from: number; to: number }; scrollTop?: number } {
    if (!this.view) {
      return {}
    }

    const cursor = {
      from: this.view.state.selection.from,
      to: this.view.state.selection.to
    }

    let scrollTop: number | undefined
    const scrollContainer = this.view.dom.closest('.crepe') as HTMLElement ||
                           this.view.dom.parentElement?.parentElement as HTMLElement
    
    if (scrollContainer) {
      scrollTop = scrollContainer.scrollTop
    }

    return { cursor, scrollTop }
  }

  restoreState(cursor: { from: number; to: number }, scrollTop: number): void {
    if (!this.view) {
      return
    }

    if (scrollTop >= 0) {
      const scrollContainer = this.view.dom.closest('.crepe') as HTMLElement ||
                             this.view.dom.parentElement?.parentElement as HTMLElement
      
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollTop
      }
    }

    if (cursor.from >= 0 && cursor.to >= 0 && cursor.from <= this.view.state.doc.content.size) {
      try {
        const tr = this.view.state.tr
          .setSelection(TextSelection.create(this.view.state.doc, cursor.from, cursor.to))
        this.view.dispatch(tr)
      } catch {
        if (cursor.from <= this.view.state.doc.content.size) {
          try {
            const tr = this.view.state.tr
              .setSelection(TextSelection.create(this.view.state.doc, cursor.from))
            this.view.dispatch(tr)
          } catch {
            // 忽略错误
          }
        }
      }
    }
  }

  focus(): void {
    if (this.view) {
      try {
        this.view.focus()
      } catch {
        // 忽略错误
      }
    }
  }
}