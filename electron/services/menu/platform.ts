// ============================================================
// Alhagi MenuBuilder - 主进程平台检测
// ============================================================

import type { Platform } from '../../../electron-protocol/commands/types'

export function detectPlatform(): Platform {
  switch (process.platform) {
    case 'darwin':
      return 'macOS'
    case 'win32':
      return 'windows'
    default:
      return 'linux'
  }
}
