// ============================================================
// Alhagi Command Registry - 渲染端薄壳
// ============================================================
//
// 实际命令数据与平台无关工具已搬到 electron-protocol/commands/registry.ts，
// 主进程菜单与渲染端共享同一份。本文件只持有：
//   1. re-export 协议层符号，保证既有 `from '@/commands/registry'` 100% 兼容
//   2. 渲染端便捷包装：getPlatformKeybinding(cmd) / isHiddenOnPlatform(cmd)
//      内部用 navigator 检测平台，对调用方零参数迁移

export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  COMMANDS,
  getCommand,
  getCommandsByCategory,
  getMenuCommands,
  getGroupedMenuCommands,
} from '@electron-protocol/commands/registry'

import {
  getPlatformKeybinding as getPlatformKeybindingRaw,
  isHiddenOnPlatform as isHiddenOnPlatformRaw,
} from '@electron-protocol/commands/registry'
import type { CommandEntry, Keybinding } from '@electron-protocol/commands/types'
import { getPlatform } from './types'

// 渲染端便捷包装：从 navigator 推断平台，省去调用方传 platform
export function getPlatformKeybinding(command: CommandEntry): Keybinding | undefined {
  return getPlatformKeybindingRaw(command, getPlatform())
}

export function isHiddenOnPlatform(command: CommandEntry): boolean {
  return isHiddenOnPlatformRaw(command, getPlatform())
}
