// ============================================================
// Alhagi FileWatcher - 打开文件的外部修改检测（P2-10）
// ============================================================
//
// 设计：
//   - 只监视渲染端「已打开」的文件（通过 add/remove 显式管理），
//     不监视整个工作目录——后者对大型项目性能成本太高。
//   - awaitWriteFinish 保证大文件写完才触发，避免半写时读到截断内容。
//   - markSaved(path) 记入 recentlySaves；接下来 SAVE_DEBOUNCE_MS 毫秒内的
//     change 事件被认为是「自己刚保存」，过滤掉，避免「保存 → 提示外部修改」死循环。
//   - recentlySaves 由三处协同回收，避免长期累积：
//       (1) remove(path)        关闭 tab 时显式删该条目
//       (2) handleUnlink(path)  外部删文件时显式删（标记早已无意义）
//       (3) markSaved(path)     每次保存顺手扫一遍删过期条目（兜底）
//   - 每个 watcher 实例与一个 WindowManager 绑定；change 路由到具体 windowId
//     的 BrowserWindow，避免跨窗口干扰。

import { watch, type FSWatcher } from 'chokidar'
import type { WindowManager } from './WindowManager'
import { IPC_CHANNELS } from '../../electron-protocol/channels'

const SAVE_DEBOUNCE_MS = 2000
const SAFE_WRITE_TEMP_RE = /\.alhagi-tmp-/

export class FileWatcher {
  private chokidar: FSWatcher | null = null
  /** path → 引用计数（多窗口可能同时打开同一文件） */
  private watched = new Map<string, number>()
  /** path → 最近一次自己保存的时间戳 */
  private recentlySaves = new Map<string, number>()

  constructor(private windowManager: WindowManager) {}

  /**
   * 标记一个文件刚被自己保存，接下来 SAVE_DEBOUNCE_MS 内的 change 事件忽略。
   * 应在 FileSystemService.registerSave/SaveAs/SaveBinary 写文件后立即调用。
   * 副作用：顺手清理 recentlySaves 中所有已过期条目，避免长期运行内存泄漏。
   */
  markSaved(filePath: string): void {
    this.pruneRecentlySaves()
    this.recentlySaves.set(filePath, Date.now())
  }

  /**
   * 开始监视一个文件。多个窗口可能同时打开同一文件，引用计数管理。
   */
  add(filePath: string): void {
    const prev = this.watched.get(filePath) ?? 0
    this.watched.set(filePath, prev + 1)
    if (prev === 0) {
      this.ensureWatcher().add(filePath)
    }
  }

  /**
   * 停止监视一个文件（引用计数减一；到 0 才真正 unwatch）。
   * 引用计数归零时同步清理 recentlySaves —— 文件已不再被任何窗口打开，
   * 标记时间戳没有意义，留着只会泄漏。
   */
  remove(filePath: string): void {
    const prev = this.watched.get(filePath) ?? 0
    if (prev <= 0) return
    if (prev === 1) {
      this.watched.delete(filePath)
      this.recentlySaves.delete(filePath)
      this.chokidar?.unwatch(filePath)
    } else {
      this.watched.set(filePath, prev - 1)
    }
  }

  /**
   * 用渲染端最新的「打开文件列表」覆盖给定窗口的监视集合：
   *   - 新增的路径 add
   *   - 移除的路径 remove
   * 提供给 WindowManager.updateOpenedFiles 调用，免去显式 add/remove 配对。
   */
  syncForWindow(prevPaths: readonly string[], nextPaths: readonly string[]): void {
    const prev = new Set(prevPaths)
    const next = new Set(nextPaths)
    for (const p of next) if (!prev.has(p)) this.add(p)
    for (const p of prev) if (!next.has(p)) this.remove(p)
  }

  dispose(): void {
    void this.chokidar?.close()
    this.chokidar = null
    this.watched.clear()
    this.recentlySaves.clear()
  }

  private ensureWatcher(): FSWatcher {
    if (this.chokidar) return this.chokidar
    this.chokidar = watch([], {
      persistent: true,
      ignoreInitial: true,
      ignored: (filePath: string) => SAFE_WRITE_TEMP_RE.test(filePath),
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 150,
      },
    })
    this.chokidar.on('change', (filePath: string) => this.handleChange(filePath))
    this.chokidar.on('unlink', (filePath: string) => this.handleUnlink(filePath))
    this.chokidar.on('error', (err: unknown) => {
      console.error('[FileWatcher] chokidar error:', err)
    })
    return this.chokidar
  }

  private handleChange(filePath: string): void {
    if (this.isRecentlySaved(filePath)) return
    // 通知所有持有此文件的窗口
    for (const [windowId, openFiles] of this.windowManager.getOpenFilesMap()) {
      if (!openFiles.includes(filePath)) continue
      const win = this.windowManager.getWindow(windowId)
      if (!win || win.isDestroyed()) continue
      win.webContents.send(IPC_CHANNELS.FILE.EXTERNAL_CHANGED, {
        filePath,
        kind: 'modified' as const,
      })
    }
  }

  private handleUnlink(filePath: string): void {
    if (this.isRecentlySaved(filePath)) return

    // 文件已被外部删除，自己之前的保存时间戳无意义；立即清理
    this.recentlySaves.delete(filePath)
    for (const [windowId, openFiles] of this.windowManager.getOpenFilesMap()) {
      if (!openFiles.includes(filePath)) continue
      const win = this.windowManager.getWindow(windowId)
      if (!win || win.isDestroyed()) continue
      win.webContents.send(IPC_CHANNELS.FILE.EXTERNAL_CHANGED, {
        filePath,
        kind: 'deleted' as const,
      })
    }
  }

  private isRecentlySaved(filePath: string): boolean {
    const ts = this.recentlySaves.get(filePath)
    if (!ts) return false
    const elapsed = Date.now() - ts
    if (elapsed > SAVE_DEBOUNCE_MS) {
      this.recentlySaves.delete(filePath)
      return false
    }
    return true
  }

  /** 兜底回收：遍历 recentlySaves，删所有早于 SAVE_DEBOUNCE_MS 的条目 */
  private pruneRecentlySaves(): void {
    if (this.recentlySaves.size === 0) return
    const cutoff = Date.now() - SAVE_DEBOUNCE_MS
    for (const [path, ts] of this.recentlySaves) {
      if (ts < cutoff) this.recentlySaves.delete(path)
    }
  }
}
