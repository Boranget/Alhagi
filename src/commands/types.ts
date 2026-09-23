// ============================================================
// Alhagi Command System - 渲染端类型层（薄壳 + KeyboardEvent 适配）
// ============================================================
//
// 纯类型和平台无关字符串/键位工具已搬到 electron-protocol/commands/types.ts
// 让主进程菜单与渲染端共享。本文件只持有：
//   1. re-export 协议层符号，保证既有 `from '@/commands/types'` 100% 兼容
//   2. 渲染端独占的 navigator 平台检测（getPlatform）
//   3. 渲染端独占的 KeyboardEvent 匹配（matchKeyEvent）

export type {
  CommandCategory,
  ExecutionContext,
  ContextKey,
  KeyModifiers,
  Keybinding,
  CommandEntry,
  CommandHandler,
  CommandHandlerEntry,
  CommandResult,
  CommandContext,
  Platform,
} from '@electron-protocol/commands/types'

export {
  parseAccelerator,
  formatKeybinding,
  parseKeybinding,
} from '@electron-protocol/commands/types'

import type { Platform, Keybinding } from '@electron-protocol/commands/types'
import {
  formatAccelerator as formatAcceleratorRawImpl,
  parseAccelerator,
} from '@electron-protocol/commands/types'

// 获取当前平台（渲染端 navigator 版本）
export function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'windows'
  const p = navigator.platform.toLowerCase()
  if (p.includes('mac')) return 'macOS'
  if (p.includes('win')) return 'windows'
  return 'linux'
}

// formatAccelerator 的渲染端便捷包装：platform 默认取自 navigator
export function formatAccelerator(accelerator: string, platform: Platform = getPlatform()): string {
  return formatAcceleratorRawImpl(accelerator, platform)
}

// 匹配键盘事件（兼容 accelerator 和 keybinding）
// 依赖 KeyboardEvent，仅渲染端可用。
export function matchKeyEvent(
  event: KeyboardEvent,
  binding: Keybinding | string
): boolean {
  if (typeof binding === 'string') {
    const parsed = parseAccelerator(binding)
    const ctrlKey = event.ctrlKey || event.metaKey
    const altKey = event.altKey
    const shiftKey = event.shiftKey
    const metaKey = event.metaKey

    if (parsed.ctrl && !ctrlKey) return false
    if (parsed.alt && !altKey) return false
    if (parsed.shift && !shiftKey) return false
    if (parsed.meta && !metaKey) return false

    const eventKey = event.key.toLowerCase()
    const bindingKey = parsed.key.toLowerCase()

    const specialKeyMap: Record<string, string[]> = {
      ' ': ['space', ' '],
      'arrowup': ['arrowup', 'up'],
      'arrowdown': ['arrowdown', 'down'],
      'arrowleft': ['arrowleft', 'left'],
      'arrowright': ['arrowright', 'right'],
    }

    if (specialKeyMap[eventKey]) {
      return specialKeyMap[eventKey].includes(bindingKey)
    }

    return eventKey === bindingKey
  } else {
    const ctrlKey = event.ctrlKey || event.metaKey
    const altKey = event.altKey
    const shiftKey = event.shiftKey
    const metaKey = event.metaKey

    if (binding.modifiers.ctrl && !ctrlKey) return false
    if (binding.modifiers.alt && !altKey) return false
    if (binding.modifiers.shift && !shiftKey) return false
    if (binding.modifiers.meta && !metaKey) return false

    const eventKey = event.key.toUpperCase()
    const bindingKey = binding.key.toUpperCase()

    return eventKey === bindingKey
  }
}
