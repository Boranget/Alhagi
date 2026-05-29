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

// 命令执行上下文
export type ExecutionContext = 'editor' | 'global' | 'both'

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

// 命令入口定义
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

// 快捷键格式化的平台差异
export type Platform = 'macOS' | 'windows' | 'linux'

// 格式化快捷键显示
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

// 解析快捷键字符串
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

// 匹配键盘事件
export function matchKeyEvent(
  event: KeyboardEvent, 
  keybinding: Keybinding
): boolean {
  const ctrlKey = event.ctrlKey || event.metaKey
  const altKey = event.altKey
  const shiftKey = event.shiftKey
  const metaKey = event.metaKey
  
  if (keybinding.modifiers.ctrl && !ctrlKey) return false
  if (keybinding.modifiers.alt && !altKey) return false
  if (keybinding.modifiers.shift && !shiftKey) return false
  if (keybinding.modifiers.meta && !metaKey) return false
  
  const eventKey = event.key.toUpperCase()
  const bindingKey = keybinding.key.toUpperCase()
  
  if (eventKey !== bindingKey) return false
  
  return true
}
