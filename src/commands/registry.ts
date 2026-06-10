// ============================================================
// Alhagi Command Registry - 单一数据源
// ============================================================

import type { CommandEntry, CommandCategory } from './types'

// 类别到菜单标签的映射
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  file: '文件',
  edit: '编辑',
  format: '格式',
  paragraph: '段落',
  table: '表格',
  view: '视图',
  tools: '工具',
  help: '帮助',
}

// 类别到菜单顺序的映射
export const CATEGORY_ORDER: Record<CommandCategory, number> = {
  file: 1,
  edit: 2,
  format: 3,
  paragraph: 4,
  table: 5,
  view: 6,
  tools: 7,
  help: 8,
}

// 命令注册表 - 单一数据源
export const COMMANDS: CommandEntry[] = [
  // ==================== 文件操作 ====================
  {
    id: 'file.new',
    category: 'file',
    label: '新建',
    description: '创建新文件',
    keybinding: { key: 'n', modifiers: { ctrl: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'file.open',
    category: 'file',
    label: '打开',
    description: '打开文件',
    keybinding: { key: 'o', modifiers: { ctrl: true } },
    executionContext: 'global',
    menuGroup: 2,
  },
  {
    id: 'file.openFolder',
    category: 'file',
    label: '打开文件夹',
    description: '打开文件夹',
    executionContext: 'global',
    menuGroup: 2,
  },
  {
    id: 'file.save',
    category: 'file',
    label: '保存',
    description: '保存文件',
    keybinding: { key: 's', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'file.saveAs',
    category: 'file',
    label: '另存为',
    description: '另存为新文件',
    keybinding: { key: 's', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'file.close',
    category: 'file',
    label: '关闭',
    description: '关闭当前文件',
    keybinding: { key: 'w', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 4,
  },

  // ==================== 编辑操作 ====================
  {
    id: 'edit.undo',
    category: 'edit',
    label: '撤销',
    description: '撤销上次操作',
    keybinding: { key: 'z', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['canUndo'],
    menuGroup: 1,
  },
  {
    id: 'edit.redo',
    category: 'edit',
    label: '重做',
    description: '重做上次撤销',
    keybinding: { key: 'z', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['canRedo'],
    menuGroup: 1,
  },
  {
    id: 'edit.cut',
    category: 'edit',
    label: '剪切',
    description: '剪切选中文本',
    keybinding: { key: 'x', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasSelection', 'isEditorFocused'],
    menuGroup: 2,
  },
  {
    id: 'edit.copy',
    category: 'edit',
    label: '复制',
    description: '复制选中文本',
    keybinding: { key: 'c', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasSelection'],
    menuGroup: 2,
  },
  {
    id: 'edit.paste',
    category: 'edit',
    label: '粘贴',
    description: '粘贴剪贴板内容',
    keybinding: { key: 'v', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['isEditorFocused'],
    menuGroup: 2,
  },
  {
    id: 'edit.selectAll',
    category: 'edit',
    label: '全选',
    description: '全选文本',
    keybinding: { key: 'a', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'edit.find',
    category: 'edit',
    label: '查找',
    description: '查找文本',
    keybinding: { key: 'f', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 4,
  },
  {
    id: 'edit.replace',
    category: 'edit',
    label: '替换',
    description: '查找并替换',
    keybinding: { key: 'h', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 4,
  },

  // ==================== 格式化 ====================
  {
    id: 'format.bold',
    category: 'format',
    label: '粗体',
    description: '切换粗体',
    keybinding: { key: 'b', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'format.italic',
    category: 'format',
    label: '斜体',
    description: '切换斜体',
    keybinding: { key: 'i', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'format.strikethrough',
    category: 'format',
    label: '删除线',
    description: '切换删除线',
    keybinding: { key: 's', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'format.code',
    category: 'format',
    label: '行内代码',
    description: '切换行内代码',
    keybinding: { key: '`', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'format.link',
    category: 'format',
    label: '链接',
    description: '插入链接',
    keybinding: { key: 'k', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'format.image',
    category: 'format',
    label: '图片',
    description: '插入图片',
    keybinding: { key: 'i', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'format.highlight',
    category: 'format',
    label: '高亮',
    description: '文本高亮',
    keybinding: { key: 'h', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },

  // ==================== 段落 ====================
  {
    id: 'paragraph.heading1',
    category: 'paragraph',
    label: '标题 1',
    description: '切换为一级标题',
    keybinding: { key: '1', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'paragraph.heading2',
    category: 'paragraph',
    label: '标题 2',
    description: '切换为二级标题',
    keybinding: { key: '2', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'paragraph.heading3',
    category: 'paragraph',
    label: '标题 3',
    description: '切换为三级标题',
    keybinding: { key: '3', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'paragraph.paragraph',
    category: 'paragraph',
    label: '段落',
    description: '切换为段落',
    keybinding: { key: '0', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'paragraph.quote',
    category: 'paragraph',
    label: '引用',
    description: '切换引用块',
    keybinding: { key: 'q', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'paragraph.bulletList',
    category: 'paragraph',
    label: '无序列表',
    description: '切换无序列表',
    keybinding: { key: 'u', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'paragraph.orderedList',
    category: 'paragraph',
    label: '有序列表',
    description: '切换有序列表',
    keybinding: { key: 'o', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'paragraph.taskList',
    category: 'paragraph',
    label: '任务列表',
    description: '切换任务列表',
    keybinding: { key: 'x', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'paragraph.codeBlock',
    category: 'paragraph',
    label: '代码块',
    description: '插入代码块',
    keybinding: { key: 'c', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 4,
  },
  {
    id: 'paragraph.mathBlock',
    category: 'paragraph',
    label: '数学公式',
    description: '插入数学公式块',
    keybinding: { key: 'm', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 4,
  },
  {
    id: 'paragraph.horizontalRule',
    category: 'paragraph',
    label: '分割线',
    description: '插入分割线',
    keybinding: { key: '-', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 5,
  },

  // ==================== 表格 ====================
  {
    id: 'table.insert',
    category: 'table',
    label: '插入表格',
    description: '插入新表格',
    keybinding: { key: 't', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'table.insertRowAbove',
    category: 'table',
    label: '上方插入行',
    description: '在当前行上方插入行',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'table.insertRowBelow',
    category: 'table',
    label: '下方插入行',
    description: '在当前行下方插入行',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'table.insertColumnLeft',
    category: 'table',
    label: '左侧插入列',
    description: '在当前列左侧插入列',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'table.insertColumnRight',
    category: 'table',
    label: '右侧插入列',
    description: '在当前列右侧插入列',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'table.deleteRow',
    category: 'table',
    label: '删除行',
    description: '删除当前行',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'table.deleteColumn',
    category: 'table',
    label: '删除列',
    description: '删除当前列',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },

  // ==================== 视图 ====================
  {
    id: 'view.toggleSidebar',
    category: 'view',
    label: '切换侧边栏',
    description: '显示/隐藏侧边栏',
    keybinding: { key: 'b', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'view.toggleTabBar',
    category: 'view',
    label: '切换标签栏',
    description: '显示/隐藏标签栏',
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'view.toggleStatusBar',
    category: 'view',
    label: '切换状态栏',
    description: '显示/隐藏状态栏',
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'view.toggleSourceMode',
    category: 'view',
    label: '源码模式',
    description: '切换源码/WYSIWYG模式',
    keybinding: { key: '/', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'view.wysiwygMode',
    category: 'view',
    label: 'WYSIWYG模式',
    description: '切换到WYSIWYG模式',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'view.toggleTheme',
    category: 'view',
    label: '切换主题',
    description: '切换亮色/暗色主题',
    keybinding: { key: 'd', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 3,
  },
  {
    id: 'view.zoomIn',
    category: 'view',
    label: '放大',
    description: '放大编辑器',
    keybinding: { key: '=', modifiers: { ctrl: true } },
    executionContext: 'editor',
    menuGroup: 4,
  },
  {
    id: 'view.zoomOut',
    category: 'view',
    label: '缩小',
    description: '缩小编辑器',
    keybinding: { key: '-', modifiers: { ctrl: true } },
    executionContext: 'editor',
    menuGroup: 4,
  },
  {
    id: 'view.resetZoom',
    category: 'view',
    label: '重置缩放',
    description: '重置编辑器缩放',
    keybinding: { key: '0', modifiers: { ctrl: true } },
    executionContext: 'editor',
    menuGroup: 4,
  },
  {
    id: 'view.fullscreen',
    category: 'view',
    label: '全屏',
    description: '切换全屏',
    keybinding: { key: 'f11', modifiers: {} },
    executionContext: 'global',
    menuGroup: 5,
  },
  {
    id: 'view.stickyNoteMode',
    category: 'view',
    label: '便签模式',
    description: '切换悬浮便签模式',
    keybinding: { key: 'f', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 6,
  },
  {
    id: 'view.immersiveMode',
    category: 'view',
    label: '沉浸模式',
    description: '切换沉浸式写作模式',
    keybinding: { key: 'enter', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 6,
  },
  {
    id: 'view.focusMode',
    category: 'view',
    label: '专注模式',
    description: '切换专注模式',
    executionContext: 'global',
    menuGroup: 6,
  },
  {
    id: 'view.typewriterMode',
    category: 'view',
    label: '打字机模式',
    description: '切换打字机模式',
    keybinding: { key: 't', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 6,
  },
  {
    id: 'view.nextTab',
    category: 'view',
    label: '下一个标签',
    description: '切换到下一个标签页',
    keybinding: { key: 'tab', modifiers: { ctrl: true } },
    executionContext: 'global',
    when: ['hasOpenFile'],
    menuGroup: 7,
  },
  {
    id: 'view.prevTab',
    category: 'view',
    label: '上一个标签',
    description: '切换到上一个标签页',
    keybinding: { key: 'tab', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    when: ['hasOpenFile'],
    menuGroup: 7,
  },

  // ==================== 工具 ====================
  {
    id: 'tools.preferences',
    category: 'tools',
    label: '设置',
    description: '打开设置',
    keybinding: { key: ',', modifiers: { ctrl: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'tools.export',
    category: 'tools',
    label: '导出',
    description: '导出文件',
    keybinding: { key: 'e', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'tools.exportHTML',
    category: 'tools',
    label: '导出为HTML',
    description: '导出为HTML文件',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'tools.exportPDF',
    category: 'tools',
    label: '导出为PDF',
    description: '导出为PDF文件',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'tools.captureScreen',
    category: 'tools',
    label: '截图',
    description: '截取屏幕',
    keybinding: { key: 's', modifiers: { ctrl: true, alt: true } },
    executionContext: 'global',
    menuGroup: 3,
  },

  // ==================== 帮助 ====================
  {
    id: 'help.shortcuts',
    category: 'help',
    label: '快捷键列表',
    description: '查看所有快捷键',
    keybinding: { key: 'k', modifiers: { ctrl: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'help.commandPalette',
    category: 'help',
    label: '命令面板',
    description: '打开命令面板',
    keybinding: { key: 'p', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'help.about',
    category: 'help',
    label: '关于',
    description: '关于顾念笔记',
    executionContext: 'global',
    menuGroup: 2,
  },
]

// 根据 ID 查找命令
export function getCommand(id: string): CommandEntry | undefined {
  return COMMANDS.find(cmd => cmd.id === id)
}

// 根据类别获取命令
export function getCommandsByCategory(category: CommandCategory): CommandEntry[] {
  return COMMANDS.filter(cmd => cmd.category === category)
}

// 获取菜单中显示的命令
export function getMenuCommands(): CommandEntry[] {
  return COMMANDS.filter(cmd => !cmd.hidden)
}

// 按类别分组获取命令（用于菜单生成）
export function getGroupedMenuCommands(): Map<CommandCategory, CommandEntry[]> {
  const grouped = new Map<CommandCategory, CommandEntry[]>()
  
  for (const cmd of COMMANDS) {
    if (cmd.hidden) continue
    
    if (!grouped.has(cmd.category)) {
      grouped.set(cmd.category, [])
    }
    grouped.get(cmd.category)!.push(cmd)
  }
  
  // 按类别顺序排序
  const sorted = new Map([...grouped.entries()].sort(
    ([a], [b]) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b]
  ))
  
  // 每个类别内按菜单组和顺序排序
  for (const [category, commands] of sorted) {
    sorted.set(category, commands.sort((a, b) => {
      const groupDiff = (a.menuGroup ?? 0) - (b.menuGroup ?? 0)
      if (groupDiff !== 0) return groupDiff
      return (a.menuOrder ?? 0) - (b.menuOrder ?? 0)
    }))
  }
  
  return sorted
}

// 获取平台特定的快捷键
//
// 优先级：
//   1. command.platformOverrides[当前平台].keybinding（若该平台覆写为 undefined 则视为该平台无快捷键）
//   2. command.keybinding（默认）
//
// 注意：当前平台是从 navigator.platform 检测，需在浏览器/Electron 渲染端调用。
export function getPlatformKeybinding(command: CommandEntry) {
  const platform: 'macOS' | 'windows' | 'linux' =
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
      ? 'macOS'
      : typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win')
        ? 'windows'
        : 'linux'

  const override = command.platformOverrides?.[platform]
  if (override && 'keybinding' in override) {
    return override.keybinding
  }
  return command.keybinding
}

// 获取平台特定的隐藏状态
export function isHiddenOnPlatform(command: CommandEntry): boolean {
  if (command.hidden) return true
  const platform: 'macOS' | 'windows' | 'linux' =
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
      ? 'macOS'
      : typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win')
        ? 'windows'
        : 'linux'
  return command.platformOverrides?.[platform]?.hidden === true
}
