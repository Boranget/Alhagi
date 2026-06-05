// ============================================================
// Alhagi Electron Service - Electron API 封装层
// ============================================================

import type { ElectronAPI } from 'electron-protocol'
import { ElectronEventHandler } from './ElectronEventHandler'

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

/**
 * Electron 服务
 * 负责 Electron API 的封装和初始化，作为 Electron 主进程和渲染进程之间的适配层
 */
export class ElectronService {
  private static instance: ElectronService | null = null
  private api: ElectronAPI | undefined = undefined
  private eventHandler: ElectronEventHandler | null = null
  private initialized = false

  private constructor() {}

  static getInstance(): ElectronService {
    if (!ElectronService.instance) {
      ElectronService.instance = new ElectronService()
    }
    return ElectronService.instance
  }

  /**
   * 初始化 Electron 服务
   */
  initialize(): void {
    if (this.initialized) {
      console.log('[ElectronService] Already initialized, skipping')
      return
    }
    
    this.api = window.electronAPI
    if (!this.api) {
      console.warn('[ElectronService] Electron API not available')
      return
    }

    // 初始化事件处理器
    this.eventHandler = new ElectronEventHandler(this.api)
    this.eventHandler.initialize()

    this.initialized = true
    console.log('[ElectronService] Initialized successfully')
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.eventHandler) {
      this.eventHandler.dispose()
      this.eventHandler = null
    }
    this.initialized = false
    console.log('[ElectronService] Disposed')
  }

  /**
   * 获取 Electron API
   */
  getAPI(): ElectronAPI | undefined {
    return this.api
  }

  /**
   * 检查 Electron API 是否可用
   */
  isAvailable(): boolean {
    return !!this.api
  }

  /**
   * 处理标签页合并事件（从其他窗口合并过来）
   */
  setupTabMergeHandler(handler: (tabData: {
    id: string
    title: string
    content: string
    filePath: string | null
    isDirty: boolean
    viewMode: string
    cursor: { from: number; to: number }
    scrollTop?: number
  }) => void): void {
    if (!this.api) return

    this.api.onTabMerge?.(handler)
  }

  /**
   * 处理标签页分离事件（分离到新窗口）
   */
  setupTabDetachHandler(handler: (tabData: {
    id: string
    title: string
    content: string
    filePath: string | null
    isDirty: boolean
    viewMode: string
    cursor: { from: number; to: number }
    scrollTop?: number
  }) => void): void {
    if (!this.api) return

    this.api.onTabDetached?.(handler)
  }

  /**
   * 处理标签页聚焦事件
   */
  setupFocusTabHandler(handler: (filePath: string) => void): void {
    if (!this.api) return

    this.api.onFocusTabForFile?.(handler)
  }

  /**
   * 处理视图模式切换事件
   */
  setupViewModeHandler(handler: (mode: 'wysiwyg' | 'source' | 'split') => void): void {
    if (!this.api) return

    this.api.onViewMode(handler)
  }

  /**
   * 处理新窗口事件
   */
  setupNewWindowHandler(handler: () => void): void {
    if (!this.api) return

    this.api.onNewWindow(handler)
  }

  /**
   * 同步打开的文件列表到主进程
   */
  async syncOpenedFiles(filePaths: string[]): Promise<void> {
    if (!this.api) return
    await this.api.updateOpenedFiles(filePaths)
  }

  /**
   * 打开开发者工具
   */
  openDevTools(): void {
    if (this.api) {
      this.api.openDevTools()
    }
  }

  /**
   * 打开新窗口
   */
  openNewWindow(): void {
    if (this.api) {
      this.api.openNewWindow()
    }
  }

  /**
   * 打开文件夹
   */
  async openFolder(): Promise<{ success: boolean; data?: { path: string } }> {
    if (!this.api) {
      return { success: false }
    }
    return await this.api.openFolder()
  }

  /**
   * 检查文件是否已打开
   */
  async checkFileOpen(filePath: string): Promise<{ success: boolean; data?: { windowId: string | null } }> {
    if (!this.api) {
      return { success: false }
    }
    return await this.api.checkFileOpen(filePath)
  }

  /**
   * 聚焦到指定窗口
   */
  async focusWindow(windowId: string, filePath: string): Promise<void> {
    if (!this.api) return
    await this.api.focusWindow(windowId, filePath)
  }
}

export const electronService = ElectronService.getInstance()
