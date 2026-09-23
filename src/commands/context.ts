import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { ILayoutRepository } from '@core/domain/ports/repositories/ILayoutRepository'
import { useTabsStore } from '@/stores/tabs'
import { useLayoutRepository } from '@adapters/stores/layout'

const REBUILD_TRIGGERS = new Set([
  'hasOpenFile',
  'showSidebar',
  'showTabBar',
  'showStatusBar',
  'sourceMode',
  'isStickyNoteMode',
  'isImmersiveMode',
])

type ContextGetter = () => boolean | string | undefined
type RebuildCallback = () => void

class CommandContext {
  private getters = new Map<string, ContextGetter>()
  private values = new Map<string, boolean | string>()
  private rebuildCallback: RebuildCallback | null = null

  register(key: string, getter: ContextGetter): void {
    this.getters.set(key, getter)
  }

  get(key: string): boolean | string | undefined {
    if (this.values.has(key)) {
      return this.values.get(key)
    }
    const getter = this.getters.get(key)
    if (getter) {
      return getter()
    }
    return undefined
  }

  set(key: string, value: boolean | string | undefined): void {
    const oldValue = this.values.get(key)
    if (oldValue === value) return

    if (value !== undefined) {
      this.values.set(key, value)
    } else {
      this.values.delete(key)
    }

    if (REBUILD_TRIGGERS.has(key) && this.rebuildCallback) {
      this.rebuildCallback()
    }
  }

  check(when?: string | string[], whenNot?: string | string[]): boolean {
    if (when) {
      const keys = Array.isArray(when) ? when : [when]
      for (const key of keys) {
        if (!this.get(key)) {
          return false
        }
      }
    }

    if (whenNot) {
      const keys = Array.isArray(whenNot) ? whenNot : [whenNot]
      for (const key of keys) {
        if (this.get(key)) {
          return false
        }
      }
    }

    return true
  }

  isToggled(key: string): boolean {
    return !!this.get(key)
  }

  onRebuildNeeded(callback: RebuildCallback): void {
    this.rebuildCallback = callback
  }

  invalidate(): void {
    this.values.clear()
  }
}

let contextInstance: CommandContext | null = null

export function getCommandContext(): CommandContext {
  if (!contextInstance) {
    contextInstance = new CommandContext()
    initializeContext(contextInstance)
  }
  return contextInstance
}

function initializeContext(ctx: CommandContext): void {
  const tabRepo = useTabsStore()
  const layoutRepo = useLayoutRepository()

  ctx.register('hasOpenFile', () => {
    return tabRepo.hasOpenFiles()
  })

  ctx.register('isDirty', () => {
    const active = tabRepo.getActiveTab()
    return active?.isDirty ?? false
  })

  ctx.register('sourceMode', () => {
    const active = tabRepo.getActiveTab()
    return active?.viewMode === 'source'
  })

  ctx.register('wysiwygMode', () => {
    const active = tabRepo.getActiveTab()
    const mode = active?.viewMode
    return mode === 'wysiwyg' || !mode
  })

  ctx.register('isEditorFocused', () => {
    return true
  })

  ctx.register('hasSelection', () => {
    const selection = window.getSelection()
    return !!selection && selection.toString().length > 0
  })

  ctx.register('canUndo', () => {
    return true
  })

  ctx.register('canRedo', () => {
    return true
  })

  ctx.register('hasClipboard', () => {
    return navigator.clipboard !== undefined
  })

  ctx.register('isMac', () => {
    return navigator.platform.toLowerCase().includes('mac')
  })

  ctx.register('isWindows', () => {
    return navigator.platform.toLowerCase().includes('win')
  })

  ctx.register('isLinux', () => {
    const platform = navigator.platform.toLowerCase()
    return platform.includes('linux') || platform.includes('x11')
  })

  ctx.register('showSidebar', () => {
    return layoutRepo.getShowSidebar()
  })

  ctx.register('showTabBar', () => {
    return layoutRepo.getShowTabBar()
  })

  ctx.register('showStatusBar', () => {
    return layoutRepo.getShowStatusBar()
  })

  ctx.register('isStickyNoteMode', () => {
    return layoutRepo.isStickyNoteMode()
  })

  ctx.register('isImmersiveMode', () => {
    return layoutRepo.isImmersiveMode()
  })

  ctx.register('hasSearchResults', () => {
    return false
  })
}
