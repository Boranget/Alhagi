// ============================================================
// Alhagi Command System - Type Definitions
// ============================================================

// 命令类别
export type CommandCategory = 
  | 'file' 
  | 'edit' 
  | 'format' 
  | 'paragraph' 
  | 'table' 
  | 'view' 
  | 'navigation' 
  | 'tools' 
  | 'help'

// 旧的命令执行上下文（保持兼容性）
export type ExecutionContext = 'editor' | 'global' | 'both'

// 新的 Markbun 风格执行上下文
export type MarkbunExecutionContext = 'main' | 'renderer' | 'cross-process'

// 命令条件上下文键
export type ContextKey = 
  | 'hasOpenFile'           // 有打开的文件
  | 'hasSelection'          // 有选中文本
  | 'isEditorFocused'      // 编辑器获得焦点
  | 'canUndo'              // 可以撤销
  | 'canRedo'              // 可以重做
  | 'isDirty'              // 文件有修改
  | 'hasClipboard'         // 剪贴板有内容
  | 'isMac'                // macOS平台
  | 'isWindows'            // Windows平台
  | 'isLinux'              // Linux平台
  | 'sourceMode'           // 源码模式
  | 'wysiwygMode'          // WYSIWYG模式
  | 'hasSearchResults'      // 有搜索结果

// 快捷键修饰符
export interface KeyModifiers {
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}

// 快捷键定义
export interface Keybinding {
  key: string
  modifiers: KeyModifiers
}

// 旧的命令入口定义（保持兼容性）
export interface CommandEntry {
  id: string                    // 唯一标识符
  category: CommandCategory     // 类别
  label: string                 // 显示标签（用于菜单/按钮）
  description?: string          // 描述（用于提示）
  
  // 快捷键
  keybinding?: Keybinding
  
  // 执行上下文
  executionContext: ExecutionContext
  
  // 启用条件
  when?: ContextKey[]          // 必须满足的条件
  whenNot?: ContextKey[]       // 必须不满足的条件
  
  // 菜单配置
  menuGroup?: number           // 菜单分组
  menuOrder?: number           // 菜单顺序
  hidden?: boolean             // 隐藏（不显示在菜单）
  
  // 平台特定
  platformOverrides?: {
    macOS?: Partial<Pick<CommandEntry, 'keybinding' | 'hidden'>>
    windows?: Partial<Pick<CommandEntry, 'keybinding' | 'hidden'>>
    linux?: Partial<Pick<CommandEntry, 'keybinding' | 'hidden'>>
  }
}

// 新的 Markbun 风格命令入口定义
export interface MarkbunCommandEntry {
  action: string
  i18nKey: string
  accelerator?: string
  category: CommandCategory
  executionContext: MarkbunExecutionContext
  menuParent?: string
  menuSubmenu?: string
  menuGroup?: number
  hidden?: boolean
  when?: string | string[]
  toggled?: string
  platformOverrides?: {
    macOS?: Partial<Pick<MarkbunCommandEntry, 'accelerator' | 'hidden'>>
    windows?: Partial<Pick<MarkbunCommandEntry, 'accelerator' | 'hidden'>>
    linux?: Partial<Pick<MarkbunCommandEntry, 'accelerator' | 'hidden'>>
  }
}

// 命令处理器类型
export type CommandHandler<T = void> = () => T | Promise<T>

// 命令处理器注册项
export interface CommandHandlerEntry {
  handler: CommandHandler
  context?: {
    editorRef?: unknown         // 编辑器ref
    stateGetters?: Record<string, () => unknown>  // 状态获取器
  }
}

// 命令执行结果
export interface CommandResult {
  success: boolean
  error?: string
  data?: unknown
}

// 上下文状态
export interface CommandContext {
  hasOpenFile: boolean
  hasSelection: boolean
  isEditorFocused: boolean
  canUndo: boolean
  canRedo: boolean
  isDirty: boolean
  hasClipboard: boolean
  isMac: boolean
  isWindows: boolean
  isLinux: boolean
  sourceMode: boolean
  wysiwygMode: boolean
  hasSearchResults: boolean
  [key: string]: boolean | string | number | undefined
}

// 平台类型
export type Platform = 'macOS' | 'windows' | 'linux'

// 获取当前平台
export function getPlatform(): Platform {
  if (navigator.platform.toLowerCase().includes('mac')) return 'macOS'
  if (navigator.platform.toLowerCase().includes('win')) return 'windows'
  return 'linux'
}

// 解析 accelerator 字符串为按键组合
export function parseAccelerator(accelerator: string): {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
} {
  const parts = accelerator.toLowerCase().split('+')
  let key = ''
  let ctrl = false
  let alt = false
  let shift = false
  let meta = false

  for (const part of parts) {
    switch (part.trim()) {
      case 'ctrl':
      case 'control':
        ctrl = true
        break
      case 'cmdorctrl':
      case 'cmd':
      case 'meta':
      case 'super':
      case 'win':
        if (getPlatform() === 'macOS') {
          meta = true
        } else {
          ctrl = true
        }
        break
      case 'alt':
      case 'option':
        alt = true
        break
      case 'shift':
        shift = true
        break
      default:
        key = part.trim()
    }
  }

  return { key, ctrl, alt, shift, meta }
}

// 格式化 accelerator 为显示字符串
export function formatAccelerator(accelerator: string, platform: Platform = getPlatform()): string {
  const parsed = parseAccelerator(accelerator)
  const parts: string[] = []

  if (platform === 'macOS') {
    if (parsed.ctrl) parts.push('⌃')
    if (parsed.alt) parts.push('⌥')
    if (parsed.shift) parts.push('⇧')
    if (parsed.meta) parts.push('⌘')
  } else {
    if (parsed.ctrl) parts.push('Ctrl')
    if (parsed.alt) parts.push('Alt')
    if (parsed.shift) parts.push('Shift')
    if (parsed.meta) parts.push('Super')
  }

  // 格式化键名
  let key = parsed.key
  const keyMap: Record<string, string> = {
    'arrowup': platform === 'macOS' ? '↑' : 'Up',
    'arrowdown': platform === 'macOS' ? '↓' : 'Down',
    'arrowleft': platform === 'macOS' ? '←' : 'Left',
    'arrowright': platform === 'macOS' ? '→' : 'Right',
    'space': 'Space',
    'escape': platform === 'macOS' ? '⎋' : 'Esc',
    'delete': 'Delete',
    'backspace': 'Backspace',
    'enter': platform === 'macOS' ? '↵' : 'Enter',
    'tab': 'Tab',
    'plus': '+',
    'minus': '-',
  }

  if (keyMap[key]) {
    key = keyMap[key]
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }

  parts.push(key)

  return parts.join(platform === 'macOS' ? '' : '+')
}

// 格式化旧的 keybinding
export function formatKeybinding(
  keybinding: Keybinding, 
  platform: Platform = 'windows'
): string {
  const parts: string[] = []
  
  // macOS 使用符号，其他平台使用文字
  if (platform === 'macOS') {
    if (keybinding.modifiers.ctrl) parts.push('⌃')
    if (keybinding.modifiers.alt) parts.push('⌥')
    if (keybinding.modifiers.shift) parts.push('⇧')
    if (keybinding.modifiers.meta) parts.push('⌘')
  } else {
    if (keybinding.modifiers.ctrl) parts.push('Ctrl')
    if (keybinding.modifiers.alt) parts.push('Alt')
    if (keybinding.modifiers.shift) parts.push('Shift')
    if (keybinding.modifiers.meta) parts.push('Super')
  }
  
  // 格式化键名
  let key = keybinding.key.toUpperCase()
  const keyMap: Record<string, string> = {
    'ARROWUP': '↑',
    'ARROWDOWN': '↓',
    'ARROWLEFT': '←',
    'ARROWRIGHT': '→',
    'SPACE': 'Space',
    'ESCAPE': 'Esc',
    'DELETE': 'Delete',
    'BACKSPACE': 'Backspace',
    'ENTER': 'Enter',
    'TAB': 'Tab',
  }
  
  if (keyMap[key]) {
    key = keyMap[key]
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }
  
  parts.push(key)
  
  return parts.join(platform === 'macOS' ? '' : '+')
}

// 解析旧的 keybinding 字符串
export function parseKeybinding(keyString: string): Keybinding {
  const parts = keyString.toUpperCase().split('+')
  const modifiers: KeyModifiers = {}
  let key = ''
  
  for (const part of parts) {
    switch (part) {
      case 'CTRL':
      case 'CONTROL':
        modifiers.ctrl = true
        break
      case 'ALT':
      case 'OPTION':
        modifiers.alt = true
        break
      case 'SHIFT':
        modifiers.shift = true
        break
      case 'CMD':
      case 'META':
      case 'SUPER':
      case 'WIN':
        modifiers.meta = true
        break
      default:
        key = part.toLowerCase()
    }
  }
  
  return { key, modifiers }
}

// 匹配键盘事件（兼容 accelerator 和 keybinding）
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
