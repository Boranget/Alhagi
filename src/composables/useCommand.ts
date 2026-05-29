// ============================================================
// useCommand - Vue Composable for Commands
// ============================================================

import { computed } from 'vue'
import { useCommandDispatcher, executeCommand } from '@/commands/dispatcher'
import { COMMANDS, getCommand, getPlatformKeybinding } from '@/commands/registry'
import { formatKeybinding } from '@/commands/types'
import type { CommandEntry, Platform } from '@/commands/types'

// 平台检测
function getCurrentPlatform(): Platform {
  if (navigator.platform.toLowerCase().includes('mac')) return 'macOS'
  if (navigator.platform.toLowerCase().includes('win')) return 'windows'
  return 'linux'
}

// 获取所有可用命令
export function useCommands() {
  const dispatcher = useCommandDispatcher()

  // 获取所有命令
  const commands = computed(() => COMMANDS)

  // 按类别分组
  const groupedCommands = computed(() => {
    const groups = new Map<string, CommandEntry[]>()
    
    for (const cmd of COMMANDS) {
      if (cmd.hidden) continue
      
      const category = cmd.category
      if (!groups.has(category)) {
        groups.set(category, [])
      }
      groups.get(category)!.push(cmd)
    }
    
    return groups
  })

  // 获取命令是否可以执行
  const isCommandEnabled = (commandId: string): boolean => {
    return dispatcher.canExecute(commandId)
  }

  // 获取命令的快捷键显示
  const getCommandShortcut = (commandId: string): string | undefined => {
    const command = getCommand(commandId)
    if (!command) return undefined
    const keybinding = getPlatformKeybinding(command)
    if (!keybinding) return undefined
    return formatKeybinding(keybinding, getCurrentPlatform())
  }

  // 执行命令
  const runCommand = async (commandId: string): Promise<boolean> => {
    const result = await dispatcher.execute(commandId)
    return result.success
  }

  // 获取命令详情
  const getCommandInfo = (commandId: string) => {
    const command = getCommand(commandId)
    if (!command) return null

    return {
      id: command.id,
      label: command.label,
      description: command.description,
      category: command.category,
      shortcut: getCommandShortcut(commandId),
      enabled: isCommandEnabled(commandId),
      keybinding: getPlatformKeybinding(command),
    }
  }

  return {
    commands,
    groupedCommands,
    isCommandEnabled,
    getCommandShortcut,
    runCommand,
    getCommandInfo,
  }
}

// 组件中使用单个命令
export function useCommand(commandId: string) {
  const dispatcher = useCommandDispatcher()
  const platform = getCurrentPlatform()

  const command = computed(() => getCommand(commandId))
  const keybinding = computed(() => command.value ? getPlatformKeybinding(command.value) : undefined)
  const shortcut = computed(() => 
    keybinding.value ? formatKeybinding(keybinding.value, platform) : undefined
  )
  const canExecute = computed(() => dispatcher.canExecute(commandId))

  const executeCommandHandler = async (): Promise<boolean> => {
    const result = await executeCommand(commandId)
    return result.success
  }

  return {
    command,
    keybinding,
    shortcut,
    canExecute,
    execute: executeCommandHandler,
  }
}

// 快捷键相关
export function useKeyboardShortcuts() {
  const platform = getCurrentPlatform()

  // 获取所有快捷键
  const allShortcuts = computed(() => {
    const shortcuts = new Map<string, string>()
    
    for (const cmd of COMMANDS) {
      if (cmd.hidden) continue
      
      const keybinding = getPlatformKeybinding(cmd)
      if (keybinding) {
        shortcuts.set(cmd.id, formatKeybinding(keybinding, platform))
      }
    }
    
    return shortcuts
  })

  // 获取类别的快捷键
  const getShortcutsByCategory = (category: string): Array<{ command: string; shortcut: string }> => {
    const result: Array<{ command: string; shortcut: string }> = []
    
    for (const cmd of COMMANDS) {
      if (cmd.category !== category || cmd.hidden) continue
      
      const keybinding = getPlatformKeybinding(cmd)
      if (keybinding) {
        result.push({
          command: cmd.label,
          shortcut: formatKeybinding(keybinding, platform),
        })
      }
    }
    
    return result
  }

  return {
    allShortcuts,
    getShortcutsByCategory,
  }
}

// 菜单生成
export function useMenu() {
  const { getCommandShortcut, isCommandEnabled } = useCommands()

  // 生成菜单项
  const generateMenuItems = (category: string) => {
    const items: Array<{
      id: string
      label: string
      shortcut?: string
      enabled: boolean
      separator?: boolean
    }> = []

    let lastGroup = -1

    for (const cmd of COMMANDS) {
      if (cmd.category !== category || cmd.hidden) continue

      // 添加分隔线
      if (cmd.menuGroup !== undefined && cmd.menuGroup !== lastGroup && lastGroup !== -1) {
        items.push({
          id: `separator-${cmd.menuGroup}`,
          label: '',
          enabled: false,
          separator: true,
        })
      }
      lastGroup = cmd.menuGroup ?? -1

      items.push({
        id: cmd.id,
        label: cmd.label,
        shortcut: getCommandShortcut(cmd.id),
        enabled: isCommandEnabled(cmd.id),
      })
    }

    return items
  }

  return {
    generateMenuItems,
  }
}
