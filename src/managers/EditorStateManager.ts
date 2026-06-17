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
    const scrollContainer = this.getScrollContainer()

    if (scrollContainer) {
      scrollTop = scrollContainer.scrollTop
    }

    return { cursor, scrollTop }
  }

  restoreState(cursor: { from: number; to: number }, scrollTop: number): void {
    if (!this.view) {
      return
    }

    // 先恢复 selection，再恢复 scrollTop。
    // ProseMirror setSelection 过程中浏览器可能自动 scrollIntoView，
    // 如果先设 scrollTop 再 setSelection，会把刚恢复的滚动位置覆盖掉。
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

    if (scrollTop >= 0) {
      // 放到下一帧，确保 layout/v-show/split 切换和 selection dispatch 都完成后，
      // 最终以 tab.crepe.scrollTop 作为权威滚动位置。
      requestAnimationFrame(() => {
        const scrollContainer = this.getScrollContainer()
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollTop
        }
      })
    }
  }

  private getScrollContainer(): HTMLElement | null {
    if (!this.view) return null
    return (this.view.dom.closest('.crepe') as HTMLElement | null) ||
      (this.view.dom.parentElement?.parentElement as HTMLElement | null)
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
