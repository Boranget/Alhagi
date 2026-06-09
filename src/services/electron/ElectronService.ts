// ============================================================
// Alhagi Electron Service - 唯一的 Electron API 封装层
// ============================================================

import type {
  ElectronAPI,
  LineEnding,
  DetachedTabData,
  IPCResponse,
  FileTreeNode,
  DirectoryEntry,
  SearchOptions,
  SearchResult,
} from '@electron-protocol/index'
import { ElectronEventHandler } from './ElectronEventHandler'

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

/**
 * Electron 服务（单例）
 *
 * 项目中唯一的 Electron API 包装层：
 * - 负责初始化 ElectronEventHandler（主进程菜单事件转发到 eventBus）
 * - 对所有 IPC 调用提供薄包装：未在 Electron 环境运行时统一返回失败响应或空操作
 * - 所有方法签名严格对齐 `electron-protocol/index.ts` 中的 `ElectronAPI` 接口
 *   ——若 preload 没暴露某个方法，这里就不会出现，避免"幽灵 API"调用
 */
export class ElectronService {
  private static instance: ElectronService | null = null
  private api: ElectronAPI | undefined = undefined
  private eventHandler: ElectronEventHandler | null = null
  private initialized = false

  private constructor() {
    this.api = window.electronAPI
  }

  static getInstance(): ElectronService {
    if (!ElectronService.instance) {
      ElectronService.instance = new ElectronService()
    }
    return ElectronService.instance
  }

  // ========== 初始化 / 状态 ==========

  initialize(): void {
    if (this.initialized) {
      return
    }
    this.api = window.electronAPI
    if (!this.api) {
      console.warn('[ElectronService] Electron API not available')
      return
    }
    this.eventHandler = new ElectronEventHandler(this.api)
    this.eventHandler.initialize()
    this.initialized = true
  }

  dispose(): void {
    if (this.eventHandler) {
      this.eventHandler.dispose()
      this.eventHandler = null
    }
    this.initialized = false
  }

  getAPI(): ElectronAPI | undefined {
    return this.api
  }

  isAvailable(): boolean {
    return !!this.api
  }

  // ========== 文件操作 ==========

  async openFile(): Promise<IPCResponse<{ filePath: string; content: string } | null>> {
    if (!this.api) return { success: false }
    return await this.api.openFile()
  }

  async saveFile(filePath: string, content: string, lineEnding?: LineEnding): Promise<IPCResponse<boolean>> {
    if (!this.api) return { success: false }
    return await this.api.saveFile(filePath, content, lineEnding)
  }

  async saveAsFile(content: string, defaultPath?: string, lineEnding?: LineEnding): Promise<IPCResponse<string | null>> {
    if (!this.api) return { success: false }
    return await this.api.saveAsFile(content, defaultPath, lineEnding)
  }

  async readFile(filePath: string): Promise<IPCResponse<string>> {
    if (!this.api) return { success: false }
    return await this.api.readFile(filePath)
  }

  async openFolder(): Promise<IPCResponse<{ path: string; tree: FileTreeNode[] } | null>> {
    if (!this.api) return { success: false }
    return await this.api.openFolder()
  }

  async readDirectory(dirPath: string): Promise<IPCResponse<DirectoryEntry[]>> {
    if (!this.api) return { success: false }
    return await this.api.readDirectory(dirPath)
  }

  async createFile(dirPath: string, fileName: string): Promise<IPCResponse<string | null>> {
    if (!this.api) return { success: false }
    return await this.api.createFile(dirPath, fileName)
  }

  async createDirectory(dirPath: string, dirName: string): Promise<IPCResponse<string | null>> {
    if (!this.api) return { success: false }
    return await this.api.createDirectory(dirPath, dirName)
  }

  async deleteFile(filePath: string): Promise<IPCResponse<boolean>> {
    if (!this.api) return { success: false }
    return await this.api.deleteFile(filePath)
  }

  async renameFile(oldPath: string, newName: string): Promise<IPCResponse<string | null>> {
    if (!this.api) return { success: false }
    return await this.api.renameFile(oldPath, newName)
  }

  async copyFile(sourcePath: string, targetDir: string): Promise<IPCResponse<string | null>> {
    if (!this.api) return { success: false }
    return await this.api.copyFile(sourcePath, targetDir)
  }

  async moveFile(sourcePath: string, targetDir: string): Promise<IPCResponse<string | null>> {
    if (!this.api) return { success: false }
    return await this.api.moveFile(sourcePath, targetDir)
  }

  async selectDirectory(): Promise<IPCResponse<string | null>> {
    if (!this.api) return { success: false }
    return await this.api.selectDirectory()
  }

  async searchInDirectory(dirPath: string, query: string, options?: SearchOptions): Promise<IPCResponse<SearchResult[]>> {
    if (!this.api) return { success: false }
    return await this.api.searchInDirectory(dirPath, query, options)
  }

  // ========== 窗口操作 ==========

  async checkFileOpen(filePath: string): Promise<IPCResponse<{ windowId: number | null }>> {
    if (!this.api) return { success: false }
    return await this.api.checkFileOpen(filePath)
  }

  async focusWindow(windowId: number, filePath?: string): Promise<IPCResponse<boolean>> {
    if (!this.api) return { success: false }
    return await this.api.focusWindow(windowId, filePath)
  }

  async getWindowId(): Promise<IPCResponse<number | null>> {
    if (!this.api) return { success: false }
    return await this.api.getWindowId()
  }

  async listWindows(): Promise<IPCResponse<Array<{ id: number; title: string; bounds: { x: number; y: number; width: number; height: number } }>>> {
    if (!this.api) return { success: false }
    return await this.api.listWindows()
  }

  async openNewWindow(options?: { filePath?: string; tabData?: DetachedTabData; bounds?: { x: number; y: number; width: number; height: number } }): Promise<IPCResponse<boolean | number>> {
    if (!this.api) return { success: false }
    return await this.api.openNewWindow(options)
  }

  async mergeTab(tabData: DetachedTabData, targetWindowId: number): Promise<IPCResponse<boolean>> {
    if (!this.api) return { success: false }
    return await this.api.mergeTab(tabData, targetWindowId)
  }

  async updateOpenedFiles(filePaths: string[]): Promise<IPCResponse<boolean>> {
    if (!this.api) return { success: false }
    return await this.api.updateOpenedFiles(filePaths)
  }

  async getCursorScreenPoint(): Promise<IPCResponse<{ x: number; y: number } | null>> {
    if (!this.api) return { success: false }
    return await this.api.getCursorScreenPoint()
  }

  async getScreenDisplay(): Promise<IPCResponse<{ x: number; y: number; width: number; height: number } | null>> {
    if (!this.api) return { success: false }
    return await this.api.getScreenDisplay()
  }

  openDevTools(): void {
    this.api?.openDevTools()
  }

  // ========== 简便的 openNewWindow（无参数版） ==========

  /**
   * 打开一个新的空白窗口
   */
  async openBlankNewWindow(): Promise<void> {
    if (this.api) {
      await this.api.openNewWindow()
    }
  }

  // ========== 主进程到渲染端的事件订阅 ==========

  setupTabMergeHandler(handler: (tabData: DetachedTabData) => void): void {
    if (!this.api) return
    this.api.onTabMerge?.(handler)
  }

  setupTabDetachHandler(handler: (tabData: DetachedTabData) => void): void {
    if (!this.api) return
    this.api.onTabDetached?.(handler)
  }

  setupFocusTabHandler(handler: (filePath: string) => void): void {
    if (!this.api) return
    this.api.onFocusTabForFile?.(handler)
  }

  setupViewModeHandler(handler: (mode: string) => void): void {
    if (!this.api) return
    this.api.onViewMode(handler)
  }

  setupNewWindowHandler(handler: () => void): void {
    if (!this.api) return
    this.api.onNewWindow(handler)
  }
}

export const electronService = ElectronService.getInstance()

// ========== 向后兼容的便捷别名（让旧的 useElectronApi() 调用点能继续工作） ==========

/**
 * 已废弃：直接使用 `electronService` 单例代替。
 * 历史上 `useElectronApi()` 每次调用都会 new 一个新实例，造成内存浪费。
 */
export function useElectronApi(): ElectronService {
  return electronService
}
