// ============================================================
// Alhagi Keybinding Manager - 快捷键管理器
// ============================================================

import { COMMANDS, getCommand } from './registry'
import { executeCommand, canExecuteCommand } from './dispatcher'
import { matchKeyEvent, formatKeybinding } from './types'

type KeybindingListener = (event: KeyboardEvent) => void

class KeybindingManager {
  private listeners: KeybindingListener[] = []
  private isAttached = false

  // 绑定全局键盘事件监听
  attachGlobalListener(): void {
    if (this.isAttached) return

    document.addEventListener('keydown', this.handleKeyDown.bind(this))
    this.isAttached = true
    console.log('[KeybindingManager] Global listener attached')
  }

  // 移除全局键盘事件监听
  detachGlobalListener(): void {
    if (!this.isAttached) return

    document.removeEventListener('keydown', this.handleKeyDown.bind(this))
    this.isAttached = false
    console.log('[KeybindingManager] Global listener detached')
  }

  // 处理键盘事件
  private handleKeyDown(event: KeyboardEvent): void {
    // 跳过在输入框、文本域等可编辑元素中的事件
    if (this.shouldIgnoreEvent(event)) {
      return
    }

    // 查找匹配的命令
    const matchedCommand = this.findMatchingCommand(event)
    if (matchedCommand) {
      event.preventDefault()
      event.stopPropagation()
      executeCommand(matchedCommand.id)
    }

    // 调用自定义监听器
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[KeybindingManager] Listener error:', error)
      }
    }
  }

  // 判断是否应该忽略事件
  private shouldIgnoreEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement
    if (!target) return false

    // 如果是输入框、文本域等可编辑元素，只允许特定快捷键
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // 允许 Ctrl/Cmd+C/V/X/A/Z/Y, Esc 等基本快捷键
      return false
    }

    return false
  }

  // 查找匹配的命令
  private findMatchingCommand(event: KeyboardEvent) {
    for (const command of COMMANDS) {
      if (command.hidden) continue
      if (!command.keybinding) continue

      if (matchKeyEvent(event, command.keybinding)) {
        if (canExecuteCommand(command.id)) {
          return command
        }
      }
    }
    return null
  }

  // 添加自定义键盘监听器
  addListener(listener: KeybindingListener): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  // 检查命令是否有快捷键
  hasKeybinding(id: string): boolean {
    const command = getCommand(id)
    return !!command?.keybinding
  }

  // 获取命令的快捷键显示文本
  getKeybindingDisplay(id: string): string | null {
    const command = getCommand(id)
    if (!command?.keybinding) return null

    return formatKeybinding(command.keybinding)
  }

  // 获取所有快捷键映射
  getAllKeybindings(): Map<string, string> {
    const result = new Map<string, string>()

    for (const command of COMMANDS) {
      if (!command.keybinding) continue

      const display = this.getKeybindingDisplay(command.id)
      if (display) {
        result.set(command.id, display)
      }
    }

    return result
  }
}

let managerInstance: KeybindingManager | null = null

export function getKeybindingManager(): KeybindingManager {
  if (!managerInstance) {
    managerInstance = new KeybindingManager()
  }
  return managerInstance
}
