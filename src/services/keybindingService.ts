export interface Keybinding {
  id: string
  key: string
  modifiers: {
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
  }
  action: string
  description: string
  category: 'file' | 'edit' | 'view' | 'tools' | 'help'
}

export interface KeybindingConfig {
  keybindings: Keybinding[]
  customKeybindings: Record<string, Keybinding>
}

export const DEFAULT_KEYBINDINGS: Keybinding[] = [
  // 文件操作
  { id: 'file.new', key: 'n', modifiers: { ctrl: true }, action: 'file.new', description: '新建文件', category: 'file' },
  { id: 'file.open', key: 'o', modifiers: { ctrl: true }, action: 'file.open', description: '打开文件', category: 'file' },
  { id: 'file.save', key: 's', modifiers: { ctrl: true }, action: 'file.save', description: '保存文件', category: 'file' },
  { id: 'file.saveAs', key: 's', modifiers: { ctrl: true, shift: true }, action: 'file.saveAs', description: '另存为', category: 'file' },
  { id: 'file.close', key: 'w', modifiers: { ctrl: true }, action: 'file.close', description: '关闭文件', category: 'file' },
  
  // 编辑操作
  { id: 'edit.undo', key: 'z', modifiers: { ctrl: true }, action: 'edit.undo', description: '撤销', category: 'edit' },
  { id: 'edit.redo', key: 'z', modifiers: { ctrl: true, shift: true }, action: 'edit.redo', description: '重做', category: 'edit' },
  { id: 'edit.cut', key: 'x', modifiers: { ctrl: true }, action: 'edit.cut', description: '剪切', category: 'edit' },
  { id: 'edit.copy', key: 'c', modifiers: { ctrl: true }, action: 'edit.copy', description: '复制', category: 'edit' },
  { id: 'edit.paste', key: 'v', modifiers: { ctrl: true }, action: 'edit.paste', description: '粘贴', category: 'edit' },
  { id: 'edit.selectAll', key: 'a', modifiers: { ctrl: true }, action: 'edit.selectAll', description: '全选', category: 'edit' },
  { id: 'edit.find', key: 'f', modifiers: { ctrl: true }, action: 'edit.find', description: '查找', category: 'edit' },
  { id: 'edit.replace', key: 'h', modifiers: { ctrl: true }, action: 'edit.replace', description: '替换', category: 'edit' },
  
  // 视图操作
  { id: 'view.toggleSidebar', key: 'b', modifiers: { ctrl: true }, action: 'view.toggleSidebar', description: '切换侧边栏', category: 'view' },
  { id: 'view.toggleFullscreen', key: 'F11', modifiers: {}, action: 'view.toggleFullscreen', description: '切换全屏', category: 'view' },
  { id: 'view.zoomIn', key: '=', modifiers: { ctrl: true }, action: 'view.zoomIn', description: '放大', category: 'view' },
  { id: 'view.zoomOut', key: '-', modifiers: { ctrl: true }, action: 'view.zoomOut', description: '缩小', category: 'view' },
  { id: 'view.resetZoom', key: '0', modifiers: { ctrl: true }, action: 'view.resetZoom', description: '重置缩放', category: 'view' },
  
  // 工具操作
  { id: 'tools.preferences', key: ',', modifiers: { ctrl: true }, action: 'tools.preferences', description: '设置', category: 'tools' },
  { id: 'tools.export', key: 'e', modifiers: { ctrl: true, shift: true }, action: 'tools.export', description: '导出', category: 'tools' },
  
  // 帮助
  { id: 'help.shortcuts', key: 'k', modifiers: { ctrl: true }, action: 'help.shortcuts', description: '快捷键列表', category: 'help' },
  { id: 'help.about', key: '', modifiers: {}, action: 'help.about', description: '关于', category: 'help' },
]

export function formatKeybinding(keybinding: Keybinding): string {
  const parts: string[] = []
  
  if (keybinding.modifiers.ctrl) parts.push('Ctrl')
  if (keybinding.modifiers.alt) parts.push('Alt')
  if (keybinding.modifiers.shift) parts.push('Shift')
  if (keybinding.modifiers.meta) parts.push('Cmd')
  
  parts.push(keybinding.key.toUpperCase())
  
  return parts.join('+')
}

export function parseKeyString(keyString: string): Partial<Keybinding['modifiers']> & { key: string } {
  const parts = keyString.toUpperCase().split('+')
  const modifiers: Partial<Keybinding['modifiers']> = {}
  let key = ''
  
  for (const part of parts) {
    switch (part) {
      case 'CTRL':
      case 'CONTROL':
        modifiers.ctrl = true
        break
      case 'ALT':
        modifiers.alt = true
        break
      case 'SHIFT':
        modifiers.shift = true
        break
      case 'CMD':
      case 'META':
      case 'WIN':
        modifiers.meta = true
        break
      default:
        key = part.toLowerCase()
    }
  }
  
  return { ...modifiers, key }
}

export function matchKeyEvent(event: KeyboardEvent, keybinding: Keybinding): boolean {
  const ctrlKey = event.ctrlKey || event.metaKey
  const altKey = event.altKey
  const shiftKey = event.shiftKey
  
  if (keybinding.modifiers.ctrl && !ctrlKey) return false
  if (keybinding.modifiers.alt && !altKey) return false
  if (keybinding.modifiers.shift && !shiftKey) return false
  if (keybinding.modifiers.meta && !event.metaKey) return false
  
  const eventKey = event.key.toUpperCase()
  const bindingKey = keybinding.key.toUpperCase()
  
  if (eventKey !== bindingKey) return false
  
  return true
}
