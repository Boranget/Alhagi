// ============================================================
// Alhagi Command Registry - 单一数据源（电子协议共享版）
// ============================================================
//
// 主进程菜单构建 + 渲染端菜单/命令面板/快捷键面板共享同一份命令数据。
//
// 注意：
// - label 字段统一为 i18n key（约定 'commands.<id>'）。
// - getPlatformKeybinding / isHiddenOnPlatform 接受 platform 参数；
//   渲染端通过 src/commands/registry.ts 的便捷包装注入 navigator 检测，
//   主进程通过 electron/services/menu/platform.ts 的 process.platform 注入。
// - 类别 label（CATEGORY_LABELS）的值也是 i18n key（'menu.category.<cat>'）。

import type { CommandEntry, CommandCategory, Keybinding, Platform } from './types'

// 类别 → i18n key
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  file: 'menu.category.file',
  edit: 'menu.category.edit',
  format: 'menu.category.format',
  paragraph: 'menu.category.paragraph',
  table: 'menu.category.table',
  view: 'menu.category.view',
  tools: 'menu.category.tools',
  help: 'menu.category.help',
}

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
    label: 'commands.file.new',
    description: '创建新文件',
    keybinding: { key: 'n', modifiers: { ctrl: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'file.newWindow',
    category: 'file',
    label: 'commands.file.newWindow',
    description: '创建新的应用窗口',
    keybinding: { key: 'n', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'file.open',
    category: 'file',
    label: 'commands.file.open',
    description: '打开文件',
    keybinding: { key: 'o', modifiers: { ctrl: true } },
    executionContext: 'global',
    menuGroup: 2,
  },
  {
    id: 'file.openFolder',
    category: 'file',
    label: 'commands.file.openFolder',
    description: '打开文件夹',
    executionContext: 'global',
    menuGroup: 2,
  },
  {
    id: 'file.save',
    category: 'file',
    label: 'commands.file.save',
    description: '保存文件',
    keybinding: { key: 's', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'file.saveAs',
    category: 'file',
    label: 'commands.file.saveAs',
    description: '另存为新文件',
    keybinding: { key: 's', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'file.close',
    category: 'file',
    label: 'commands.file.close',
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
    label: 'commands.edit.undo',
    description: '撤销上次操作',
    keybinding: { key: 'z', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['canUndo'],
    menuGroup: 1,
  },
  {
    id: 'edit.redo',
    category: 'edit',
    label: 'commands.edit.redo',
    description: '重做上次撤销',
    keybinding: { key: 'z', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['canRedo'],
    menuGroup: 1,
  },
  {
    // Windows 用户惯用 Ctrl+Y 作为 redo 别名。隐藏不显示在菜单/命令面板，
    // 仅注册为 edit.redo 的别名快捷键，避免空触发。
    id: 'edit.redoAlt',
    category: 'edit',
    label: 'commands.edit.redo',
    description: '重做上次撤销 (alias)',
    keybinding: { key: 'y', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['canRedo'],
    hidden: true,
  },
  {
    id: 'edit.cut',
    category: 'edit',
    label: 'commands.edit.cut',
    description: '剪切选中文本',
    keybinding: { key: 'x', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasSelection', 'isEditorFocused'],
    menuGroup: 2,
  },
  {
    id: 'edit.copy',
    category: 'edit',
    label: 'commands.edit.copy',
    description: '复制选中文本',
    keybinding: { key: 'c', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasSelection'],
    menuGroup: 2,
  },
  {
    id: 'edit.paste',
    category: 'edit',
    label: 'commands.edit.paste',
    description: '粘贴剪贴板内容',
    keybinding: { key: 'v', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['isEditorFocused'],
    menuGroup: 2,
  },
  {
    id: 'edit.selectAll',
    category: 'edit',
    label: 'commands.edit.selectAll',
    description: '全选文本',
    keybinding: { key: 'a', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'edit.find',
    category: 'edit',
    label: 'commands.edit.find',
    description: '查找文本',
    keybinding: { key: 'f', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 4,
  },
  {
    id: 'edit.replace',
    category: 'edit',
    label: 'commands.edit.replace',
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
    label: 'commands.format.bold',
    description: '切换粗体',
    keybinding: { key: 'b', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'format.italic',
    category: 'format',
    label: 'commands.format.italic',
    description: '切换斜体',
    keybinding: { key: 'i', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'format.strikethrough',
    category: 'format',
    label: 'commands.format.strikethrough',
    description: '切换删除线',
    keybinding: { key: 's', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'format.code',
    category: 'format',
    label: 'commands.format.code',
    description: '切换行内代码',
    keybinding: { key: '`', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'format.link',
    category: 'format',
    label: 'commands.format.link',
    description: '插入链接',
    keybinding: { key: 'k', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'format.image',
    category: 'format',
    label: 'commands.format.image',
    description: '插入图片',
    keybinding: { key: 'i', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'format.highlight',
    category: 'format',
    label: 'commands.format.highlight',
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
    label: 'commands.paragraph.heading1',
    description: '切换为一级标题',
    keybinding: { key: '1', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'paragraph.heading2',
    category: 'paragraph',
    label: 'commands.paragraph.heading2',
    description: '切换为二级标题',
    keybinding: { key: '2', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'paragraph.heading3',
    category: 'paragraph',
    label: 'commands.paragraph.heading3',
    description: '切换为三级标题',
    keybinding: { key: '3', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'paragraph.paragraph',
    category: 'paragraph',
    label: 'commands.paragraph.paragraph',
    description: '切换为段落',
    keybinding: { key: '0', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'paragraph.quote',
    category: 'paragraph',
    label: 'commands.paragraph.quote',
    description: '切换引用块',
    keybinding: { key: 'q', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'paragraph.bulletList',
    category: 'paragraph',
    label: 'commands.paragraph.bulletList',
    description: '切换无序列表',
    keybinding: { key: 'u', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'paragraph.orderedList',
    category: 'paragraph',
    label: 'commands.paragraph.orderedList',
    description: '切换有序列表',
    keybinding: { key: 'o', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'paragraph.taskList',
    category: 'paragraph',
    label: 'commands.paragraph.taskList',
    description: '切换任务列表',
    keybinding: { key: 'x', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'paragraph.codeBlock',
    category: 'paragraph',
    label: 'commands.paragraph.codeBlock',
    description: '插入代码块',
    keybinding: { key: 'c', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 4,
  },
  {
    id: 'paragraph.mathBlock',
    category: 'paragraph',
    label: 'commands.paragraph.mathBlock',
    description: '插入数学公式块',
    keybinding: { key: 'm', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 4,
  },
  {
    id: 'paragraph.horizontalRule',
    category: 'paragraph',
    label: 'commands.paragraph.horizontalRule',
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
    label: 'commands.table.insert',
    description: '插入新表格',
    keybinding: { key: 't', modifiers: { ctrl: true, alt: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 1,
  },
  {
    id: 'table.insertRowAbove',
    category: 'table',
    label: 'commands.table.insertRowAbove',
    description: '在当前行上方插入行',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'table.insertRowBelow',
    category: 'table',
    label: 'commands.table.insertRowBelow',
    description: '在当前行下方插入行',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'table.insertColumnLeft',
    category: 'table',
    label: 'commands.table.insertColumnLeft',
    description: '在当前列左侧插入列',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'table.insertColumnRight',
    category: 'table',
    label: 'commands.table.insertColumnRight',
    description: '在当前列右侧插入列',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'table.deleteRow',
    category: 'table',
    label: 'commands.table.deleteRow',
    description: '删除当前行',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },
  {
    id: 'table.deleteColumn',
    category: 'table',
    label: 'commands.table.deleteColumn',
    description: '删除当前列',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 3,
  },

  // ==================== 视图 ====================
  {
    id: 'view.toggleSidebar',
    category: 'view',
    label: 'commands.view.toggleSidebar',
    description: '显示/隐藏侧边栏',
    keybinding: { key: 'b', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 1,
    checkbox: true,
  },
  {
    id: 'view.toggleTabBar',
    category: 'view',
    label: 'commands.view.toggleTabBar',
    description: '显示/隐藏标签栏',
    executionContext: 'global',
    menuGroup: 1,
    checkbox: true,
  },
  {
    id: 'view.toggleStatusBar',
    category: 'view',
    label: 'commands.view.toggleStatusBar',
    description: '显示/隐藏状态栏',
    executionContext: 'global',
    menuGroup: 1,
    checkbox: true,
  },
  {
    id: 'view.toggleSourceMode',
    category: 'view',
    label: 'commands.view.toggleSourceMode',
    description: '切换源码/WYSIWYG模式',
    keybinding: { key: '/', modifiers: { ctrl: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'view.wysiwygMode',
    category: 'view',
    label: 'commands.view.wysiwygMode',
    description: '切换到WYSIWYG模式',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'view.toggleTheme',
    category: 'view',
    label: 'commands.view.toggleTheme',
    description: '切换亮色/暗色主题',
    keybinding: { key: 'd', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 3,
  },
  {
    id: 'view.zoomIn',
    category: 'view',
    label: 'commands.view.zoomIn',
    description: '放大编辑器',
    keybinding: { key: '=', modifiers: { ctrl: true } },
    executionContext: 'editor',
    menuGroup: 4,
  },
  {
    id: 'view.zoomOut',
    category: 'view',
    label: 'commands.view.zoomOut',
    description: '缩小编辑器',
    keybinding: { key: '-', modifiers: { ctrl: true } },
    executionContext: 'editor',
    menuGroup: 4,
  },
  {
    id: 'view.resetZoom',
    category: 'view',
    label: 'commands.view.resetZoom',
    description: '重置编辑器缩放',
    keybinding: { key: '0', modifiers: { ctrl: true } },
    executionContext: 'editor',
    menuGroup: 4,
  },
  {
    id: 'view.devTools',
    category: 'view',
    label: 'commands.view.devTools',
    description: '打开/关闭开发者工具',
    // F12 是开发者工具的传统快捷键，避免与 format.image (Ctrl+Shift+I) 冲突
    keybinding: { key: 'f12', modifiers: {} },
    executionContext: 'global',
    menuGroup: 5,
  },  {
    id: 'view.fullscreen',
    category: 'view',
    label: 'commands.view.fullscreen',
    description: '切换全屏',
    keybinding: { key: 'f11', modifiers: {} },
    executionContext: 'global',
    menuGroup: 5,
  },
  {
    id: 'view.stickyNoteMode',
    category: 'view',
    label: 'commands.view.stickyNoteMode',
    description: '切换悬浮便签模式',
    keybinding: { key: 'f', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 6,
    checkbox: true,
  },
  {
    id: 'view.immersiveMode',
    category: 'view',
    label: 'commands.view.immersiveMode',
    description: '切换沉浸式写作模式',
    keybinding: { key: 'enter', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 6,
    checkbox: true,
  },
  {
    id: 'view.focusMode',
    category: 'view',
    label: 'commands.view.focusMode',
    description: '切换专注模式',
    executionContext: 'global',
    menuGroup: 6,
  },
  {
    id: 'view.typewriterMode',
    category: 'view',
    label: 'commands.view.typewriterMode',
    description: '切换打字机模式',
    keybinding: { key: 't', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 6,
  },
  {
    id: 'view.nextTab',
    category: 'view',
    label: 'commands.view.nextTab',
    description: '切换到下一个标签页',
    keybinding: { key: 'tab', modifiers: { ctrl: true } },
    executionContext: 'global',
    when: ['hasOpenFile'],
    menuGroup: 7,
  },
  {
    id: 'view.prevTab',
    category: 'view',
    label: 'commands.view.prevTab',
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
    label: 'commands.tools.preferences',
    description: '打开设置',
    keybinding: { key: ',', modifiers: { ctrl: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'tools.export',
    category: 'tools',
    label: 'commands.tools.export',
    description: '导出文件',
    keybinding: { key: 'e', modifiers: { ctrl: true, shift: true } },
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'tools.exportHTML',
    category: 'tools',
    label: 'commands.tools.exportHTML',
    description: '导出为HTML文件',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'tools.exportPDF',
    category: 'tools',
    label: 'commands.tools.exportPDF',
    description: '导出为PDF文件',
    executionContext: 'editor',
    when: ['hasOpenFile'],
    menuGroup: 2,
  },
  {
    id: 'tools.captureScreen',
    category: 'tools',
    label: 'commands.tools.captureScreen',
    description: '截取屏幕',
    keybinding: { key: 's', modifiers: { ctrl: true, alt: true } },
    executionContext: 'global',
    menuGroup: 3,
  },

  // ==================== 帮助 ====================
  {
    id: 'help.shortcuts',
    category: 'help',
    label: 'commands.help.shortcuts',
    description: '查看所有快捷键',
    keybinding: { key: 'k', modifiers: { ctrl: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'help.commandPalette',
    category: 'help',
    label: 'commands.help.commandPalette',
    description: '打开命令面板',
    keybinding: { key: 'p', modifiers: { ctrl: true, shift: true } },
    executionContext: 'global',
    menuGroup: 1,
  },
  {
    id: 'help.about',
    category: 'help',
    label: 'commands.help.about',
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
//   1. command.platformOverrides[platform].keybinding（若覆写为 undefined 则视为该平台无快捷键）
//   2. command.keybinding（默认）
export function getPlatformKeybinding(
  command: CommandEntry,
  platform: Platform
): Keybinding | undefined {
  const override = command.platformOverrides?.[platform]
  if (override && 'keybinding' in override) {
    return override.keybinding
  }
  return command.keybinding
}

// 获取平台特定的隐藏状态
export function isHiddenOnPlatform(
  command: CommandEntry,
  platform: Platform
): boolean {
  if (command.hidden) return true
  return command.platformOverrides?.[platform]?.hidden === true
}
