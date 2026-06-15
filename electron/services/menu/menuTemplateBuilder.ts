// ============================================================
// Alhagi MenuBuilder - 模板生成主流程
// ============================================================
//
// 从共享命令注册表 (electron-protocol/commands) 生成 Electron 菜单模板。
// 流程：
//   1. getGroupedMenuCommands() → 按 category 拆分、按 menuGroup/menuOrder 排序
//   2. 遍历每个 category 的命令：
//      - isHiddenOnPlatform 跳过
//      - menuGroup 跳变插 separator
//      - 命中 NATIVE_ROLE_MAP → { role, label }
//      - 命中 MAIN_PROCESS_COMMANDS → 主进程本地 click
//      - 默认 → click 发送 IPC_CHANNELS.COMMAND.EXECUTE 带命令 ID
//   3. 顶级 label 用 t(CATEGORY_LABELS[cat])

import type { MenuItemConstructorOptions } from 'electron'
import { BrowserWindow } from 'electron'
import {
  COMMANDS,
  CATEGORY_LABELS,
  getGroupedMenuCommands,
  getPlatformKeybinding,
  isHiddenOnPlatform,
} from '../../../electron-protocol/commands/registry'
import type {
  CommandEntry,
  CommandCategory,
  Platform,
} from '../../../electron-protocol/commands/types'
import { translate, type Language } from '../../../electron-protocol/i18n/dictionaries'
import { IPC_CHANNELS } from '../../../electron-protocol/channels'
import { keybindingToAccelerator } from './keybindingToAccelerator'
import { NATIVE_ROLE_MAP } from './nativeRoleMap'
import { MAIN_PROCESS_COMMANDS } from './mainProcessCommands'
import type { WindowManager } from '../WindowManager'

export interface BuildOptions {
  language: Language
  platform: Platform
  windowManager: WindowManager
}

/**
 * 生成 Electron 顶级菜单模板。
 */
export function buildMenuTemplate(opts: BuildOptions): MenuItemConstructorOptions[] {
  const { language, platform, windowManager } = opts
  const t = (key: string) => translate(key, language)
  const grouped = getGroupedMenuCommands()
  const template: MenuItemConstructorOptions[] = []

  for (const [category, commands] of grouped) {
    const submenu = buildSubmenu(commands, { language, platform, windowManager, t })
    if (submenu.length === 0) continue
    template.push({
      label: t(CATEGORY_LABELS[category]),
      submenu,
    })
  }

  // 追加「退出」到文件菜单末尾（不属于 registry 命令）
  const fileMenu = template.find(m =>
    m.label === t(CATEGORY_LABELS['file' as CommandCategory])
  )
  if (fileMenu && Array.isArray(fileMenu.submenu)) {
    fileMenu.submenu.push({ type: 'separator' })
    fileMenu.submenu.push({ role: 'quit', label: language === 'en' ? 'Quit' : '退出' })
  }

  if (process.env.NODE_ENV !== 'production') {
    assertCommandLabelsTranslated(language)
  }

  return template
}

interface SubmenuCtx {
  language: Language
  platform: Platform
  windowManager: WindowManager
  t: (key: string) => string
}

function buildSubmenu(
  commands: CommandEntry[],
  ctx: SubmenuCtx
): MenuItemConstructorOptions[] {
  const out: MenuItemConstructorOptions[] = []
  let lastGroup: number | undefined

  for (const cmd of commands) {
    if (isHiddenOnPlatform(cmd, ctx.platform)) continue

    if (lastGroup !== undefined && (cmd.menuGroup ?? 0) !== lastGroup) {
      out.push({ type: 'separator' })
    }
    lastGroup = cmd.menuGroup ?? lastGroup

    out.push(buildItem(cmd, ctx))
  }

  return out
}

function buildItem(cmd: CommandEntry, ctx: SubmenuCtx): MenuItemConstructorOptions {
  const label = ctx.t(cmd.label)
  const kb = getPlatformKeybinding(cmd, ctx.platform)
  const accelerator = kb ? keybindingToAccelerator(kb) ?? undefined : undefined

  // 原生 role：menu 自带 cut/copy/paste 等行为
  const role = NATIVE_ROLE_MAP[cmd.id]
  if (role) {
    return { label, accelerator, role: role as MenuItemConstructorOptions['role'] }
  }

  // 主进程本地命令（需要直接操作 BrowserWindow / dialog 的）
  // 主进程菜单直接调，不经 COMMAND.EXECUTE —— 避免渲染端 dispatcher 同时跑一遍
  // 引入「双切换」（如 devTools 开了又关）。命令面板/快捷键触发同名命令时，
  // 渲染端 dispatcher 通过 IPC 调主进程，三条入口收敛到主进程实现一处。
  const mainHandler = MAIN_PROCESS_COMMANDS[cmd.id]
  if (mainHandler) {
    return {
      label,
      accelerator,
      click: () => mainHandler({ windowManager: ctx.windowManager }),
    }
  }

  // checkbox 命令：渲染为 type: 'checkbox'。
  // 关键：
  //   - id 取自 cmd.id，让主进程能 menu.getMenuItemById(cmd.id).checked = X
  //     in-place 更新（避免重建整菜单）。
  //   - checked 默认 true，与渲染端 layout store 默认一致——这三个开关
  //     不再持久化，初始状态由 store 决定。
  //   - click 用 Electron 提供的 focusedWindow 实参，保证多窗口下点哪个
  //     窗口的菜单就发给哪个窗口。
  if (cmd.checkbox) {
    return {
      label,
      accelerator,
      id: cmd.id,
      type: 'checkbox',
      checked: true,
      click: (_item, focusedWindow) => {
        // Electron 8+ click 实参是 BaseWindow（可能是 BrowserWindow，可能不是），
        // 统一窄化到 BrowserWindow 才能拿 webContents。
        if (focusedWindow instanceof BrowserWindow) {
          focusedWindow.webContents.send(IPC_CHANNELS.COMMAND.EXECUTE, cmd.id)
        }
      },
    }
  }

  // 默认：通过 COMMAND.EXECUTE 通知渲染端 dispatcher 派发
  return {
    label,
    accelerator,
    click: (_item, focusedWindow) => {
      if (focusedWindow instanceof BrowserWindow) {
        focusedWindow.webContents.send(IPC_CHANNELS.COMMAND.EXECUTE, cmd.id)
      }
    },
  }
}

function assertCommandLabelsTranslated(language: Language): void {
  for (const cmd of COMMANDS) {
    const translated = translate(cmd.label, language)
    if (translated === cmd.label) {
      console.error(`[menu] missing i18n for command "${cmd.id}" (key="${cmd.label}", lang=${language})`)
    }
  }
}
