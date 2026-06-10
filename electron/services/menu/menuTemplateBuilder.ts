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

import type { MenuItemConstructorOptions, BrowserWindow } from 'electron'
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

  // 默认：通过 COMMAND.EXECUTE 通知渲染端 dispatcher 派发
  return {
    label,
    accelerator,
    click: () => {
      const target = getTargetWindow(ctx.windowManager)
      target?.webContents.send(IPC_CHANNELS.COMMAND.EXECUTE, cmd.id)
    },
  }
}

function getTargetWindow(windowManager: WindowManager): BrowserWindow | null {
  // 优先 focused 窗口，回退 mainWindow（保留与旧 MenuBuilder.send 一致的行为）
  const all = windowManager.getAllWindows()
  for (const win of all.values()) {
    if (!win.isDestroyed() && win.isFocused()) return win
  }
  return windowManager.getMainWindow()
}

// dev 模式自检：未翻译命令早发现
function assertCommandLabelsTranslated(language: Language): void {
  for (const cmd of COMMANDS) {
    const translated = translate(cmd.label, language)
    if (translated === cmd.label) {
      console.error(`[menu] missing i18n for command "${cmd.id}" (key="${cmd.label}", lang=${language})`)
    }
  }
}
