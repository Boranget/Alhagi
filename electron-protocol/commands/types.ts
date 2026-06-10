// ============================================================
// Alhagi Command System - 共享类型与平台无关工具函数
// ============================================================
//
// 在 P2-12 之后，命令注册表搬到 electron-protocol/ 让主进程和渲染端
// 共享同一份数据源。本文件持有 *平台无关* 的类型与字符串/键位工具。
//
// 渲染端依赖的 KeyboardEvent 处理（matchKeyEvent）保留在 src/commands/types.ts。
// 平台检测在调用方：
//   - 渲染端 src/commands/platform.ts 用 navigator.platform
//   - 主进程 electron/services/menu/platform.ts 用 process.platform

// 命令类别
export type CommandCategory =
  | 'file'
  | 'edit'
  | 'format'
  | 'paragraph'
  | 'table'
  | 'view'
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
  /**
   * 显示标签 —— 自 P2-12 起统一为 i18n key（约定 `commands.<id>`，
   * 例如 `'commands.file.new'`），消费方必须经 t() 翻译。
   */
  label: string
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
    editorRef?: unknown
    stateGetters?: Record<string, () => unknown>
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

// ------------------------------------------------------------
// 平台无关的字符串/键位解析工具
// ------------------------------------------------------------

// 解析 accelerator 字符串为按键组合
// 注：parseAccelerator 内部不再调用 getPlatform()，而是把 cmd/meta 都映射到 meta，
// 实际平台差异在 matchKeyEvent / accelerator 输出时处理。这样可在主进程跑（无 navigator）。
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
        // CmdOrCtrl 在协议层统一视为 ctrl（matchKeyEvent 已把 ctrlKey||metaKey 折叠匹配）
        ctrl = true
        break
      case 'cmd':
      case 'meta':
      case 'super':
      case 'win':
        meta = true
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

// 显示用键名映射：单一数据源，formatAccelerator / formatKeybinding 共用
const KEY_DISPLAY_MAP_MAC: Record<string, string> = {
  'arrowup': '↑',
  'arrowdown': '↓',
  'arrowleft': '←',
  'arrowright': '→',
  'space': 'Space',
  'escape': '⎋',
  'delete': 'Delete',
  'backspace': 'Backspace',
  'enter': '↵',
  'tab': 'Tab',
  'plus': '+',
  'minus': '-',
}

const KEY_DISPLAY_MAP_OTHER: Record<string, string> = {
  'arrowup': 'Up',
  'arrowdown': 'Down',
  'arrowleft': 'Left',
  'arrowright': 'Right',
  'space': 'Space',
  'escape': 'Esc',
  'delete': 'Delete',
  'backspace': 'Backspace',
  'enter': 'Enter',
  'tab': 'Tab',
  'plus': '+',
  'minus': '-',
}

function displayKey(key: string, platform: Platform): string {
  const lower = key.toLowerCase()
  const map = platform === 'macOS' ? KEY_DISPLAY_MAP_MAC : KEY_DISPLAY_MAP_OTHER
  if (map[lower]) return map[lower]
  return lower.length === 1 ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1)
}

// 格式化 accelerator 字符串
// platform 必须由调用方提供（避免内部依赖 navigator/process）
export function formatAccelerator(accelerator: string, platform: Platform): string {
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

  parts.push(displayKey(parsed.key, platform))
  return parts.join(platform === 'macOS' ? '' : '+')
}

// 格式化 Keybinding
//
// 关键转换：因为 matchKeyEvent 中 ctrl 修饰键在所有平台都会兼容地匹配
// `event.ctrlKey || event.metaKey`，所以在 macOS 上显示时，应当把
// `ctrl` 渲染为 ⌘（Cmd 键）而非 ⌃（Control 键），与用户实际按键一致。
// 显式声明 `meta` 的快捷键则总是显示为 ⌘。
export function formatKeybinding(
  keybinding: Keybinding,
  platform: Platform = 'windows'
): string {
  const parts: string[] = []

  if (platform === 'macOS') {
    // ctrl 在 macOS 视为 Cmd（与触发逻辑一致）
    if (keybinding.modifiers.ctrl || keybinding.modifiers.meta) parts.push('⌘')
    if (keybinding.modifiers.alt) parts.push('⌥')
    if (keybinding.modifiers.shift) parts.push('⇧')
  } else {
    if (keybinding.modifiers.ctrl) parts.push('Ctrl')
    if (keybinding.modifiers.alt) parts.push('Alt')
    if (keybinding.modifiers.shift) parts.push('Shift')
    if (keybinding.modifiers.meta) parts.push('Super')
  }

  parts.push(displayKey(keybinding.key, platform))
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
