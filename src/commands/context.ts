// ============================================================
// Alhagi Command Context - 上下文条件系统
// ============================================================

import type { CommandContext, ContextKey } from './types'

// 全局上下文实例
let contextInstance: CommandContextImpl | null = null

class CommandContextImpl {
  private stateGetters: Map<ContextKey, () => boolean> = new Map()
  private cachedContext: CommandContext | null = null
  private cacheValid = false

  constructor() {
    this.registerDefaultGetters()
  }

  // 注册默认的状态获取器
  private registerDefaultGetters() {
    // 平台检测
    this.register('isMac', () => navigator.platform.toLowerCase().includes('mac'))
    this.register('isWindows', () => navigator.platform.toLowerCase().includes('win'))
    this.register('isLinux', () => navigator.platform.toLowerCase().includes('linux'))
  }

  // 注册状态获取器
  register(key: ContextKey, getter: () => boolean) {
    this.stateGetters.set(key, getter)
    this.cacheValid = false
  }

  // 批量注册状态获取器
  registerBatch(getters: Record<ContextKey, () => boolean>) {
    for (const [key, getter] of Object.entries(getters)) {
      this.stateGetters.set(key as ContextKey, getter)
    }
    this.cacheValid = false
  }

  // 获取当前上下文状态
  getContext(): CommandContext {
    // 如果缓存有效，直接返回
    if (this.cacheValid && this.cachedContext) {
      return this.cachedContext
    }

    const context: CommandContext = {
      hasOpenFile: false,
      hasSelection: false,
      isEditorFocused: false,
      canUndo: false,
      canRedo: false,
      isDirty: false,
      hasClipboard: false,
      isMac: false,
      isWindows: false,
      isLinux: false,
      sourceMode: false,
      wysiwygMode: false,
      hasSearchResults: false,
    }

    // 调用所有注册的状态获取器
    for (const [key, getter] of this.stateGetters) {
      try {
        context[key] = getter()
      } catch (error) {
        console.warn(`[CommandContext] Failed to get context key "${key}":`, error)
        context[key] = false
      }
    }

    this.cachedContext = context
    this.cacheValid = true

    return context
  }

  // 获取单个上下文值
  get(key: ContextKey): boolean {
    const getter = this.stateGetters.get(key)
    if (!getter) {
      console.warn(`[CommandContext] Unknown context key: "${key}"`)
      return false
    }

    try {
      return getter()
    } catch (error) {
      console.warn(`[CommandContext] Failed to get context key "${key}":`, error)
      return false
    }
  }

  // 检查条件是否满足
  check(when: ContextKey[] | undefined, whenNot: ContextKey[] | undefined): boolean {
    // 检查 when 条件（必须全部满足）
    if (when && when.length > 0) {
      for (const key of when) {
        if (!this.get(key)) {
          return false
        }
      }
    }

    // 检查 whenNot 条件（必须全部不满足）
    if (whenNot && whenNot.length > 0) {
      for (const key of whenNot) {
        if (this.get(key)) {
          return false
        }
      }
    }

    return true
  }

  // 使缓存失效
  invalidate() {
    this.cacheValid = false
  }

  // 清除所有注册的状态获取器
  clear() {
    this.stateGetters.clear()
    this.cacheValid = false
    this.cachedContext = null
  }
}

// 获取或创建全局上下文实例
export function getCommandContext(): CommandContextImpl {
  if (!contextInstance) {
    contextInstance = new CommandContextImpl()
  }
  return contextInstance
}



// 创建响应式上下文（用于Vue组件）
export function useCommandContext() {
  const ctx = getCommandContext()
  
  return {
    getContext: () => ctx.getContext(),
    get: (key: ContextKey) => ctx.get(key),
    check: (when?: ContextKey[], whenNot?: ContextKey[]) => ctx.check(when, whenNot),
    invalidate: () => ctx.invalidate(),
  }
}
