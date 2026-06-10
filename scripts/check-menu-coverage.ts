// ============================================================
// Alhagi P2-12 静态自检：i18n 翻译覆盖度 + accelerator 转换覆盖度
// ============================================================
//
// 用法：cd alhagi && npx tsx scripts/check-menu-coverage.ts
//
// 报告（非 0 退出码）：
//   - 命令 label 在 zhCN/en 字典中缺失
//   - 类别 label 缺失
//   - Keybinding 经 keybindingToAccelerator 转换后产生 null（未知 key）
//
// 这是 dev 模式断言之外的离线检查，CI 友好。

import { COMMANDS, CATEGORY_LABELS, getPlatformKeybinding } from '../electron-protocol/commands/registry'
import { translate } from '../electron-protocol/i18n/dictionaries'
import { keybindingToAccelerator } from '../electron/services/menu/keybindingToAccelerator'

const issues: string[] = []
const LANGS = ['zh-CN', 'en'] as const
const PLATFORMS = ['windows', 'macOS', 'linux'] as const

for (const lang of LANGS) {
  // 类别
  for (const cat of Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>) {
    const key = CATEGORY_LABELS[cat]
    if (translate(key, lang) === key) {
      issues.push(`[i18n] missing category translation: lang=${lang} key=${key}`)
    }
  }
  // 命令 label
  for (const cmd of COMMANDS) {
    if (translate(cmd.label, lang) === cmd.label) {
      issues.push(`[i18n] missing command translation: lang=${lang} id=${cmd.id} key=${cmd.label}`)
    }
  }
}

// keybinding → accelerator 覆盖
for (const platform of PLATFORMS) {
  for (const cmd of COMMANDS) {
    const kb = getPlatformKeybinding(cmd, platform)
    if (!kb) continue
    const acc = keybindingToAccelerator(kb)
    if (acc === null) {
      issues.push(`[accelerator] unknown key for cmd=${cmd.id} platform=${platform} key=${kb.key}`)
    }
  }
}

if (issues.length === 0) {
  console.log(`[check-menu-coverage] OK: ${COMMANDS.length} commands × ${LANGS.length} langs × ${PLATFORMS.length} platforms — all translated and translatable.`)
  process.exit(0)
}

console.error(`[check-menu-coverage] ${issues.length} issue(s):`)
for (const i of issues) console.error('  ' + i)
process.exit(1)
