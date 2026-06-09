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
  // 1. 初始化所有命令处理器
  initCommandHandlers()

  // 2. 启用快捷键管理
  const keybindingManager = getKeybindingManager()
  keybindingManager.attachGlobalListener()

  // 3. 加载用户自定义快捷键
  loadCustomKeybindings(keybindingManager)
}

// 从 localStorage 加载自定义快捷键
function loadCustomKeybindings(manager: ReturnType<typeof getKeybindingManager>): void {
  const saved = localStorage.getItem('alhagi-custom-keybindings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (typeof parsed === 'object') {
        manager.setCustomKeybindings(parsed)
      }
    } catch {
      // 静默忽略无效 JSON
    }
  }
}

// 销毁命令系统
export function destroyCommandSystem(): () => void {
  return () => {
    const keybindingManager = getKeybindingManager()
    keybindingManager.detachGlobalListener()
  }
}
