// ============================================================
// Alhagi Command Context - 命令上下文管理
// ============================================================

import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'

// 触发菜单重建的上下文键（低频变化的键）
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

  // 注册一个上下文值的 getter
  register(key: string, getter: ContextGetter): void {
    this.getters.set(key, getter)
  }

  // 获取上下文值
  get(key: string): boolean | string | undefined {
    if (this.values.has(key)) {
      return this.values.get(key)
    }
    const getter = this.getters.get(key)
    if (getter) {
      const value = getter()
      if (value !== undefined) {
        this.values.set(key, value)
      }
      return value
    }
    return undefined
  }

  // 直接设置上下文值
  set(key: string, value: boolean | string | undefined): void {
    const oldValue = this.values.get(key)
    if (oldValue === value) return

    if (value !== undefined) {
      this.values.set(key, value)
    } else {
      this.values.delete(key)
    }

    // 触发菜单重建
    if (REBUILD_TRIGGERS.has(key) && this.rebuildCallback) {
      this.rebuildCallback()
    }
  }

  // 检查条件是否满足
  check(when?: string | string[], whenNot?: string | string[]): boolean {
    // 检查 when 条件
    if (when) {
      const keys = Array.isArray(when) ? when : [when]
      for (const key of keys) {
        if (!this.get(key)) {
          return false
        }
      }
    }

    // 检查 whenNot 条件
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

  // 检查是否是切换状态
  isToggled(key: string): boolean {
    return !!this.get(key)
  }

  // 设置菜单重建回调
  onRebuildNeeded(callback: RebuildCallback): void {
    this.rebuildCallback = callback
  }

  // 清除缓存值，强制重新计算
  invalidate(): void {
    this.values.clear()
  }
}

// 创建全局单例
let contextInstance: CommandContext | null = null

export function getCommandContext(): CommandContext {
  if (!contextInstance) {
    contextInstance = new CommandContext()
    initializeContext(contextInstance)
  }
  return contextInstance
}

// 初始化上下文 getter
function initializeContext(ctx: CommandContext): void {
  // 文件相关
  ctx.register('hasOpenFile', () => {
    const tabsStore = useTabsStore()
    return tabsStore.tabs.size > 0
  })

  ctx.register('isDirty', () => {
    const tabsStore = useTabsStore()
    return tabsStore.activeTab?.isDirty ?? false
  })

  ctx.register('sourceMode', () => {
    const tabsStore = useTabsStore()
    return tabsStore.activeTab?.viewMode === 'source'
  })

  ctx.register('wysiwygMode', () => {
    const tabsStore = useTabsStore()
    const mode = tabsStore.activeTab?.viewMode
    return mode === 'wysiwyg' || !mode
  })

  // 编辑器状态
  ctx.register('isEditorFocused', () => {
    // 暂时默认返回 true，后续可以完善
    return true
  })

  ctx.register('hasSelection', () => {
    const selection = window.getSelection()
    return !!selection && selection.toString().length > 0
  })

  ctx.register('canUndo', () => {
    // 暂时默认返回 true，后续可以根据编辑器历史状态判断
    return true
  })

  ctx.register('canRedo', () => {
    // 暂时默认返回 true，后续可以根据编辑器历史状态判断
    return true
  })

  ctx.register('hasClipboard', () => {
    return navigator.clipboard !== undefined
  })

  // 平台检测
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

  // UI 状态
  ctx.register('showSidebar', () => {
    const prefsStore = usePreferencesStore()
    return prefsStore.showSidebar
  })

  ctx.register('showTabBar', () => {
    const prefsStore = usePreferencesStore()
    return prefsStore.showTabBar
  })

  ctx.register('showStatusBar', () => {
    const prefsStore = usePreferencesStore()
    return prefsStore.showStatusBar
  })

  ctx.register('isStickyNoteMode', () => {
    const prefsStore = usePreferencesStore()
    return prefsStore.isStickyNoteMode
  })

  ctx.register('isImmersiveMode', () => {
    const prefsStore = usePreferencesStore()
    return prefsStore.isImmersiveMode
  })

  ctx.register('hasSearchResults', () => {
    return false
  })
}
