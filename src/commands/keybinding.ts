// ============================================================
// Alhagi Keybinding Manager - 快捷键管理器
// ============================================================

import { COMMANDS, getCommand, getPlatformKeybinding, isHiddenOnPlatform } from './registry'
import { executeCommand, canExecuteCommand } from './dispatcher'
import { matchKeyEvent, formatKeybinding, getPlatform } from './types'
import type { Keybinding } from './types'
import { useTabsStore } from '@/stores/tabs'

type KeybindingListener = (event: KeyboardEvent) => void

class KeybindingManager {
  private listeners: KeybindingListener[] = []
  private isAttached = false
  // 用户自定义快捷键覆盖（commandId → Keybinding）
  private customKeybindings = new Map<string, Keybinding>()

  // 在属性初始化时绑定 this 并保存引用，确保 addEventListener/removeEventListener
  // 使用同一个函数引用
  private handleKeyDown = this.handleKeyDownImpl.bind(this)

  // 绑定全局键盘事件监听
  attachGlobalListener(): void {
    if (this.isAttached) return

    document.addEventListener('keydown', this.handleKeyDown)
    this.isAttached = true

    // 开发模式：检测重复键位，帮助快速定位"按一个键触发多个命令"的 bug
    if (import.meta.env.DEV) {
      this.detectConflicts()
    }
  }

  // 移除全局键盘事件监听
  detachGlobalListener(): void {
    if (!this.isAttached) return

    document.removeEventListener('keydown', this.handleKeyDown)
    this.isAttached = false
  }

  // 处理键盘事件
  private handleKeyDownImpl(event: KeyboardEvent): void {
    // 跳过在输入框、文本域等可编辑元素中的事件
    if (this.shouldIgnoreEvent(event)) {
      return
    }

    // 先查找匹配的命令（优先使用用户自定义快捷键）
    const matchedCommand = this.findMatchingCommand(event)
    if (matchedCommand) {
      event.preventDefault()
      event.stopPropagation()
      executeCommand(matchedCommand.id)
      return
    }

    // 未匹配自定义快捷键时，回退到 Ctrl+1~9 快速切换标签页
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      const num = parseInt(event.key)
      if (num >= 1 && num <= 9) {
        event.preventDefault()
        event.stopPropagation()
        const tabsStore = useTabsStore()
        const index = num - 1
        if (index < tabsStore.tabOrder.length) {
          tabsStore.switchTab(tabsStore.tabOrder[index])
        }
        return
      }
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
  //
  // 在可编辑元素（INPUT/TEXTAREA/contenteditable，含 ProseMirror 与
  // 代码块内的 CodeMirror）中放行**浏览器/编辑器自己处理更准确**的少数键，
  // 让 ProseMirror/CodeMirror 的内部 history、选区、剪贴板 serializer 接管：
  //
  //   Ctrl+C/V/X/A → 浏览器原生 contenteditable 剪贴板/选区行为
  //   Ctrl+Z       → ProseMirror/CodeMirror 内部 history undo
  //   Ctrl+Shift+Z → 同上 redo
  //
  // 其他快捷键（Ctrl+S/B/I/1/...）继续走命令系统。
  //
  // 注意：Ctrl+Y 不在拦截列表里——Windows 习惯用它做 redo，registry 中
  // 通过隐藏的 edit.redoAlt 命令绑定到 Ctrl+Y，统一走 eventBus emit EDIT_REDO，
  // 由 EditorContainer 按当前模式（wysiwyg/source/split）分发到 PM 或 CM。
  // 之前 Ctrl+Y 被一并拦截但无人接管，Windows 用户按下没反应是个静默 bug。
  private shouldIgnoreEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement
    if (!target) return false

    const isEditable =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable

    if (!isEditable) return false

    const mod = event.ctrlKey || event.metaKey
    if (!mod || event.altKey) return false

    const k = event.key.toLowerCase()
    // C/V/X/A：剪贴板与选区，不区分 shift（Ctrl+Shift+A 等没人用作命令）
    if (k === 'c' || k === 'v' || k === 'x' || k === 'a') return true
    // Z：undo / redo，shift 与否都让 native 接管（PM/CM 内部 history 最准）
    if (k === 'z') return true

    return false
  }

  // 查找匹配的命令（优先使用自定义快捷键，其次平台特定快捷键，最后默认快捷键）
  private findMatchingCommand(event: KeyboardEvent) {
    for (const command of COMMANDS) {
      if (isHiddenOnPlatform(command)) continue

      // 优先使用自定义快捷键；否则用平台特定/默认快捷键
      const customBinding = this.customKeybindings.get(command.id)
      const binding = customBinding || getPlatformKeybinding(command)
      if (!binding) continue

      if (matchKeyEvent(event, binding)) {
        if (canExecuteCommand(command.id)) {
          return command
        }
      }
    }
    return null
  }

  // 设置用户自定义快捷键覆盖
  setCustomKeybindings(overrides: Record<string, Keybinding>): void {
    this.customKeybindings.clear()
    for (const [commandId, binding] of Object.entries(overrides)) {
      this.customKeybindings.set(commandId, binding)
    }
  }

  // 获取命令的有效快捷键（自定义优先，否则平台特定/默认）
  getEffectiveKeybinding(commandId: string): Keybinding | undefined {
    const custom = this.customKeybindings.get(commandId)
    if (custom) return custom
    const command = getCommand(commandId)
    return command ? getPlatformKeybinding(command) : undefined
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
    return !!this.getEffectiveKeybinding(id)
  }

  // 获取命令的快捷键显示文本（自动按当前平台格式化：macOS 用符号，其他用 Ctrl/Alt/Shift）
  getKeybindingDisplay(id: string): string | null {
    const binding = this.getEffectiveKeybinding(id)
    if (!binding) return null
    return formatKeybinding(binding, getPlatform())
  }

  // 获取所有快捷键映射
  getAllKeybindings(): Map<string, string> {
    const result = new Map<string, string>()

    for (const command of COMMANDS) {
      const display = this.getKeybindingDisplay(command.id)
      if (display) {
        result.set(command.id, display)
      }
    }

    return result
  }

  /**
   * 扫描命令注册表中的重复键位。
   *
   * 同一快捷键绑定到多个命令是 bug——按下时哪个被触发取决于
   * COMMANDS 数组顺序，行为不可预期。开发模式下 console.warn 提示。
   * 注意：自定义快捷键覆盖在这里也参与判断，避免用户改键改出冲突。
   */
  private detectConflicts(): void {
    // 用归一化字符串（含修饰键）作为 key，命令 id 数组作为 value
    const bucket = new Map<string, string[]>()

    for (const command of COMMANDS) {
      if (isHiddenOnPlatform(command)) continue

      const custom = this.customKeybindings.get(command.id)
      const binding = custom || getPlatformKeybinding(command)
      if (!binding) continue

      const key = this.normalizeBindingKey(binding)
      const existing = bucket.get(key)
      if (existing) {
        existing.push(command.id)
      } else {
        bucket.set(key, [command.id])
      }
    }

    for (const [key, ids] of bucket) {
      if (ids.length > 1) {
        console.warn(
          `[KeybindingManager] Keybinding conflict: "${key}" is bound to multiple commands:`,
          ids,
        )
      }
    }
  }

  private normalizeBindingKey(binding: Keybinding): string {
    const mods: string[] = []
    if (binding.modifiers.ctrl) mods.push('Ctrl')
    if (binding.modifiers.alt) mods.push('Alt')
    if (binding.modifiers.shift) mods.push('Shift')
    if (binding.modifiers.meta) mods.push('Meta')
    return `${mods.join('+')}${mods.length ? '+' : ''}${binding.key.toLowerCase()}`
  }
}

let managerInstance: KeybindingManager | null = null

export function getKeybindingManager(): KeybindingManager {
  if (!managerInstance) {
    managerInstance = new KeybindingManager()
  }
  return managerInstance
}
