// ============================================================
// Alhagi Command System - 主入口
// ============================================================

// 导出所有类型
export * from './types'

// 导出命令注册表
export * from './registry'

// 导出调度器
export * from './dispatcher'

// 导出上下文
export * from './context'

// 导出快捷键管理
export * from './keybinding'

// 导出处理器
export { initCommandHandlers } from './handlers'

import { initCommandHandlers } from './handlers'
import { getKeybindingManager } from './keybinding'

// 初始化命令系统
export function initCommandSystem(): void {
  console.log('[CommandSystem] Initializing...')

  // 1. 初始化所有命令处理器
  initCommandHandlers()

  // 2. 启用快捷键管理
  const keybindingManager = getKeybindingManager()
  keybindingManager.attachGlobalListener()

  console.log('[CommandSystem] Initialized successfully')
}

// 销毁命令系统
export function destroyCommandSystem(): void {
  const keybindingManager = getKeybindingManager()
  keybindingManager.detachGlobalListener()
}
