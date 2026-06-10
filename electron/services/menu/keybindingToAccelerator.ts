// ============================================================
// Alhagi MenuBuilder - Keybinding → Electron accelerator
// ============================================================
//
// Electron 的 accelerator 字符串格式：
//   - 修饰键：'CmdOrCtrl' / 'Cmd' / 'Ctrl' / 'Alt' / 'Shift' / 'Super'
//   - 按键：单字符大写（A-Z 0-9）、特殊键 'Up'/'Down'/'Return'/'Esc'/'F11'/...
//   - 连接符：'+'
//
// 我们的 Keybinding.modifiers.ctrl 表达「主修饰键」语义，运行时 matchKeyEvent
// 同时接受 ctrlKey 或 metaKey；菜单层映射为 'CmdOrCtrl' 让 Electron 自己跨平台
// 触发。modifiers.meta 表达「明确要 Cmd」，映射为 'Cmd'。

import type { Keybinding } from '../../../electron-protocol/commands/types'

// 键名到 Electron accelerator 键名的映射
// 单字符自动 .toUpperCase()，其它走映射表
const KEY_TO_ACCELERATOR: Record<string, string> = {
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  enter: 'Return',
  escape: 'Esc',
  space: 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  plus: 'Plus',
  minus: '-',
  '`': '`',
  ',': ',',
  '.': '.',
  '/': '/',
  ';': ';',
  "'": "'",
  '[': '[',
  ']': ']',
  '\\': '\\',
  '=': '=',
}

// F1-F24
for (let i = 1; i <= 24; i++) {
  KEY_TO_ACCELERATOR[`f${i}`] = `F${i}`
}

/**
 * 把 Keybinding 转为 Electron accelerator 字符串。
 *
 * @returns accelerator 字符串（如 'CmdOrCtrl+Shift+S'）；若 key 含未知 token
 *          返回 null 并 console.error，菜单生成方应跳过 accelerator 设置。
 */
export function keybindingToAccelerator(kb: Keybinding): string | null {
  const parts: string[] = []
  if (kb.modifiers.ctrl) parts.push('CmdOrCtrl')
  if (kb.modifiers.meta) parts.push('Cmd')
  if (kb.modifiers.alt) parts.push('Alt')
  if (kb.modifiers.shift) parts.push('Shift')

  const lower = kb.key.toLowerCase()
  let token: string | undefined

  if (KEY_TO_ACCELERATOR[lower]) {
    token = KEY_TO_ACCELERATOR[lower]
  } else if (lower.length === 1) {
    // 单字符按键：字母数字大写
    token = lower.toUpperCase()
  }

  if (!token) {
    console.error(
      `[menu] keybindingToAccelerator: unknown key "${kb.key}"; skip accelerator`
    )
    return null
  }

  parts.push(token)
  return parts.join('+')
}
