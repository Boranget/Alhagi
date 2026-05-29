// ============================================================
// Alhagi Command Keybinding - 快捷键管理
// ============================================================

import { onMounted, onUnmounted, ref } from 'vue'
import type { Keybinding } from './types'
import { matchKeyEvent } from './types'
import { COMMANDS, getPlatformKeybinding } from './registry'
import { executeCommand, getDispatcher } from './dispatcher'

// 忽略按键的标签
const IGNORE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

// 快捷键到命令ID的映射
const keybindingMap = new Map<string, string>()

// 初始化快捷键映射
function initKeybindingMap() {
  keybindingMap.clear()
  
  for (const command of COMMANDS) {
    if (command.hidden) continue
    
    const keybinding = getPlatformKeybinding(command)
    if (!keybinding) continue
    
    const key = serializeKeybinding(keybinding)
    keybindingMap.set(key, command.id)
  }
}

// 序列化快捷键为字符串
function serializeKeybinding(keybinding: Keybinding): string {
  const parts: string[] = []
  
  if (keybinding.modifiers.ctrl) parts.push('ctrl')
  if (keybinding.modifiers.alt) parts.push('alt')
  if (keybinding.modifiers.shift) parts.push('shift')
  if (keybinding.modifiers.meta) parts.push('meta')
  
  parts.push(keybinding.key.toLowerCase())
  
  return parts.join('+')
}

class KeybindingManager {
  private enabled = true
  private globalHandler: ((event: KeyboardEvent) => void) | null = null

  constructor() {
    initKeybindingMap()
  }

  // 启用/禁用
  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }

  isEnabled(): boolean {
    return this.enabled
  }

  // 处理键盘事件
  handleKeydown(event: KeyboardEvent): boolean {
    if (!this.enabled) return false

    // 忽略修饰键单独按下
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      return false
    }

    // 忽略在特定输入元素中的按键
    const target = event.target as HTMLElement
    if (target.isContentEditable || IGNORE_TAGS.has(target.tagName)) {
      // 但仍处理某些全局快捷键
      return false
    }

    // 尝试匹配快捷键
    for (const [serialized, commandId] of keybindingMap) {
      const parts = serialized.split('+')
      const modifiers: Keybinding = {
        key: parts[parts.length - 1],
        modifiers: {
          ctrl: parts.includes('ctrl'),
          alt: parts.includes('alt'),
          shift: parts.includes('shift'),
          meta: parts.includes('meta'),
        },
      }

      if (matchKeyEvent(event, modifiers)) {
        // 检查命令是否可执行
        if (getDispatcher().canExecute(commandId)) {
          event.preventDefault()
          event.stopPropagation()
          
          // 异步执行命令
          executeCommand(commandId).catch(error => {
            console.error(`[KeybindingManager] Command "${commandId}" failed:`, error)
          })
          
          return true
        }
      }
    }

    return false
  }

  // 获取命令的快捷键
  getKeybinding(commandId: string): Keybinding | undefined {
    const command = COMMANDS.find(c => c.id === commandId)
    if (!command) return undefined
    return getPlatformKeybinding(command)
  }

  // 获取所有快捷键
  getAllKeybindings(): Map<string, Keybinding> {
    const result = new Map<string, Keybinding>()
    
    for (const command of COMMANDS) {
      if (command.hidden) continue
      
      const keybinding = getPlatformKeybinding(command)
      if (keybinding) {
        result.set(command.id, keybinding)
      }
    }
    
    return result
  }

  // 注册全局键盘监听器
  attachGlobalListener() {
    if (this.globalHandler) return

    this.globalHandler = (event: KeyboardEvent) => {
      this.handleKeydown(event)
    }

    document.addEventListener('keydown', this.globalHandler, true)
  }

  // 移除全局键盘监听器
  detachGlobalListener() {
    if (this.globalHandler) {
      document.removeEventListener('keydown', this.globalHandler, true)
      this.globalHandler = null
    }
  }

  // 重新初始化（当命令注册表更新时）
  refresh() {
    initKeybindingMap()
  }
}

// 全局实例
let managerInstance: KeybindingManager | null = null

export function getKeybindingManager(): KeybindingManager {
  if (!managerInstance) {
    managerInstance = new KeybindingManager()
  }
  return managerInstance
}

// Vue Composable
export function useKeybindings() {
  const manager = getKeybindingManager()
  const enabled = ref(true)

  onMounted(() => {
    manager.attachGlobalListener()
  })

  onUnmounted(() => {
    manager.detachGlobalListener()
  })

  return {
    enabled,
    enable: () => {
      manager.enable()
      enabled.value = true
    },
    disable: () => {
      manager.disable()
      enabled.value = false
    },
    getKeybinding: (commandId: string) => manager.getKeybinding(commandId),
    getAllKeybindings: () => manager.getAllKeybindings(),
    handleKeydown: (event: KeyboardEvent) => manager.handleKeydown(event),
  }
}

// 便捷函数
export function executeWithKeybinding(keybinding: Keybinding, handler: () => void) {
  if (matchKeyEvent(new KeyboardEvent('keydown', {
    key: keybinding.key,
    ctrlKey: keybinding.modifiers.ctrl,
    altKey: keybinding.modifiers.alt,
    shiftKey: keybinding.modifiers.shift,
    metaKey: keybinding.modifiers.meta,
  }), keybinding)) {
    handler()
  }
}
