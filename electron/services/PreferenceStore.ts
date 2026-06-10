// ============================================================
// Alhagi PreferenceStore - 主进程持久化偏好（electron-store 包装）
// ============================================================
//
// 持久化分两类：
//
// 1. 主进程自有偏好（窗口几何状态、主题模式）：用于启动时无需等待渲染端就绪
//    即可决定窗口大小、背景色等。
//
// 2. 用户全量偏好（getUserPreferences / setUserPreferences）：渲染端的
//    preferences store 通过 IPC 同步过来的扁平字典。原存在 localStorage，
//    现迁移到主进程 electron-store，多窗口数据来源一致，不会被清缓存清掉。
//
// schema 版本字段（__schemaVersion）用于未来 migration，比如重命名字段、
// 转换字段类型等。

import Store from 'electron-store'
import type { WindowState } from '../../electron-protocol'

/** 主进程自有的存储结构（窗口/主题） */
export interface MainStoreSchema {
  windowState: WindowState
  theme: 'light' | 'dark' | 'system'
  /** 用户全量偏好（来自渲染端 preferences store），扁平 K→V */
  userPreferences?: Record<string, unknown>
  /** 偏好 schema 版本号，用于将来 migration */
  __schemaVersion?: number
}

/** 当前 schema 版本号；之后改字段时同步递增并加 migration 逻辑 */
const CURRENT_SCHEMA_VERSION = 1

export class PreferenceStore {
  private store: Store<MainStoreSchema>

  constructor() {
    this.store = new Store<MainStoreSchema>({
      defaults: {
        windowState: { width: 1200, height: 800, isMaximized: false },
        theme: 'light',
        userPreferences: undefined,
        __schemaVersion: CURRENT_SCHEMA_VERSION,
      },
    })
    this.runMigrations()
  }

  // ---------- 主进程自有偏好 ----------

  getWindowState(): WindowState {
    return this.store.get('windowState')
  }

  setWindowState(state: WindowState): void {
    this.store.set('windowState', state)
  }

  getTheme(): 'light' | 'dark' | 'system' {
    return this.store.get('theme') || 'light'
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.store.set('theme', theme)
  }

  // ---------- 用户全量偏好（渲染端镜像） ----------

  /** 读取用户偏好。返回 null 表示从未保存过（首次启动）。 */
  getUserPreferences(): Record<string, unknown> | null {
    const prefs = this.store.get('userPreferences')
    return prefs ?? null
  }

  /** 整体覆写用户偏好。 */
  setUserPreferences(prefs: Record<string, unknown>): void {
    this.store.set('userPreferences', prefs)
  }

  // ---------- Migration ----------

  /**
   * 启动时执行 schema migration。每次 schema 字段变动应：
   *  1. 升 CURRENT_SCHEMA_VERSION
   *  2. 在此添加 if 分支处理旧版本数据
   *  3. 最后写回新版本号
   */
  private runMigrations(): void {
    const stored = this.store.get('__schemaVersion')
    if (stored === CURRENT_SCHEMA_VERSION) return

    // 例：从未初始化（旧用户首次升级到 P1-3）
    if (stored === undefined || stored === null) {
      // 没有历史数据需要迁移，直接打版本号
      this.store.set('__schemaVersion', CURRENT_SCHEMA_VERSION)
      return
    }

    // 未来：if (stored === 1) { ...升级到 2... }

    this.store.set('__schemaVersion', CURRENT_SCHEMA_VERSION)
  }
}
