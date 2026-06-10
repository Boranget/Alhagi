// ============================================================
// Alhagi MenuBuilder - 应用菜单构建（数据驱动版）
// ============================================================
//
// 实际模板生成委托给 menu/menuTemplateBuilder.ts，本类只是：
//   - 注入 WindowManager 依赖
//   - 缓存当前语言，方便 rebuild()
//   - 调 Menu.setApplicationMenu

import { Menu } from 'electron'
import type { WindowManager } from './WindowManager'
import { buildMenuTemplate } from './menu/menuTemplateBuilder'
import { detectPlatform } from './menu/platform'
import type { Language } from '../../electron-protocol/i18n/dictionaries'

export class MenuBuilder {
  private currentLanguage: Language = 'zh-CN'

  constructor(private windowManager: WindowManager) {}

  install(language?: Language): void {
    if (language) this.currentLanguage = language
    const template = buildMenuTemplate({
      language: this.currentLanguage,
      platform: detectPlatform(),
      windowManager: this.windowManager,
    })
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }

  /**
   * 切换语言后重建应用菜单。
   */
  rebuild(language: Language): void {
    this.install(language)
  }

  getCurrentLanguage(): Language {
    return this.currentLanguage
  }
}
