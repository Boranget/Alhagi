import type { ElectronAPI, LineEnding, DetachedTabData, WindowInfo, SearchResult, SearchOptions } from '@electron-protocol/index'

export class ElectronApiService {
  private api: ElectronAPI | undefined

  constructor() {
    this.api = window.electronAPI
  }

  isAvailable(): boolean {
    return !!this.api
  }

  getAPI(): ElectronAPI | undefined {
    return this.api
  }

  async openFile(): Promise<{ success: boolean; data?: { filePath: string; content: string } }> {
    if (!this.api) return { success: false }
    return await this.api.openFile()
  }

  async saveFile(filePath: string, content: string, lineEnding: LineEnding): Promise<{ success: boolean }> {
    if (!this.api) return { success: false }
    return await this.api.saveFile(filePath, content, lineEnding)
  }

  async saveAsFile(content: string, defaultPath: string, lineEnding: LineEnding): Promise<{ success: boolean; data?: string }> {
    if (!this.api) return { success: false }
    return await this.api.saveAsFile(content, defaultPath, lineEnding)
  }

  async readFile(filePath: string): Promise<{ success: boolean; data?: string }> {
    if (!this.api) return { success: false }
    return await this.api.readFile(filePath)
  }

  async openFolder(): Promise<{ success: boolean; data?: { path: string; tree: unknown[] } }> {
    if (!this.api) return { success: false }
    return await this.api.openFolder()
  }

  async listWindows(): Promise<{ success: boolean; data?: WindowInfo[] }> {
    if (!this.api) return { success: false }
    return await this.api.listWindows()
  }

  async getWindowId(): Promise<{ success: boolean; data?: number }> {
    if (!this.api) return { success: false }
    return await this.api.getWindowId()
  }

  async checkFileOpen(filePath: string): Promise<{ success: boolean; data?: { windowId: number | null } }> {
    if (!this.api) return { success: false }
    return await this.api.checkFileOpen(filePath)
  }

  async focusWindow(windowId: number, filePath: string): Promise<void> {
    if (!this.api) return
    await this.api.focusWindow(windowId, filePath)
  }

  async openNewWindow(options?: { bounds?: { x: number; y: number; width?: number; height?: number }; tabData?: DetachedTabData }): Promise<{ success: boolean; data?: number }> {
    if (!this.api) return { success: false }
    return await this.api.openNewWindow(options)
  }

  async mergeTab(tabData: DetachedTabData, targetWindowId: number): Promise<{ success: boolean }> {
    if (!this.api) return { success: false }
    return await this.api.mergeTab(tabData, targetWindowId)
  }

  async updateOpenedFiles(filePaths: string[]): Promise<void> {
    if (!this.api) return
    await this.api.updateOpenedFiles(filePaths)
  }

  async getCursorScreenPoint(): Promise<{ success: boolean; data?: { x: number; y: number } }> {
    if (!this.api) return { success: false }
    return await this.api.getCursorScreenPoint()
  }

  async getScreenDisplay(): Promise<{ success: boolean; data?: { x: number; y: number; width: number; height: number } }> {
    if (!this.api) return { success: false }
    return await this.api.getScreenDisplay()
  }

  async searchFiles(options: SearchOptions): Promise<{ success: boolean; data?: SearchResult[] }> {
    if (!this.api) return { success: false }
    return await this.api.searchFiles(options)
  }

  async selectDirectory(): Promise<{ success: boolean; data?: string }> {
    if (!this.api) return { success: false }
    return await this.api.selectDirectory()
  }

  async selectFile(filter?: string[]): Promise<{ success: boolean; data?: string }> {
    if (!this.api) return { success: false }
    return await this.api.selectFile(filter)
  }

  async showSaveDialog(defaultPath: string): Promise<{ success: boolean; data?: string }> {
    if (!this.api) return { success: false }
    return await this.api.showSaveDialog(defaultPath)
  }

  async showOpenDialog(filters?: { name: string; extensions: string[] }[]): Promise<{ success: boolean; data?: string[] }> {
    if (!this.api) return { success: false }
    return await this.api.showOpenDialog(filters)
  }

  async copyFile(source: string, target: string): Promise<{ success: boolean }> {
    if (!this.api) return { success: false }
    return await this.api.copyFile(source, target)
  }

  async deleteFile(path: string): Promise<{ success: boolean }> {
    if (!this.api) return { success: false }
    return await this.api.deleteFile(path)
  }

  async deleteDirectory(path: string): Promise<{ success: boolean }> {
    if (!this.api) return { success: false }
    return await this.api.deleteDirectory(path)
  }

  async exists(path: string): Promise<{ success: boolean; data?: boolean }> {
    if (!this.api) return { success: false }
    return await this.api.exists(path)
  }

  async getFileStats(path: string): Promise<{ success: boolean; data?: { size: number; mtime: number; isDirectory: boolean } }> {
    if (!this.api) return { success: false }
    return await this.api.getFileStats(path)
  }

  async getTempDirectory(): Promise<{ success: boolean; data?: string }> {
    if (!this.api) return { success: false }
    return await this.api.getTempDirectory()
  }

  async writeFile(path: string, content: string): Promise<{ success: boolean }> {
    if (!this.api) return { success: false }
    return await this.api.writeFile(path, content)
  }

  async readDirectory(path: string): Promise<{ success: boolean; data?: unknown[] }> {
    if (!this.api) return { success: false }
    return await this.api.readDirectory(path)
  }

  openDevTools(): void {
    this.api?.openDevTools()
  }

  minimizeWindow(): void {
    this.api?.minimizeWindow()
  }

  maximizeWindow(): void {
    this.api?.maximizeWindow()
  }

  unmaximizeWindow(): void {
    this.api?.unmaximizeWindow()
  }

  closeWindow(): void {
    this.api?.closeWindow()
  }

  quitApp(): void {
    this.api?.quitApp()
  }

  restartApp(): void {
    this.api?.restartApp()
  }

  showNotification(title: string, body: string): void {
    this.api?.showNotification(title, body)
  }

  showErrorNotification(title: string, message: string): void {
    this.api?.showErrorNotification(title, message)
  }

  setTitle(title: string): void {
    this.api?.setTitle(title)
  }

  async getAppVersion(): Promise<{ success: boolean; data?: string }> {
    if (!this.api) return { success: false }
    return await this.api.getAppVersion()
  }

  async getSystemInfo(): Promise<{ success: boolean; data?: { platform: string; arch: string } }> {
    if (!this.api) return { success: false }
    return await this.api.getSystemInfo()
  }

  async getPath(pathName: 'home' | 'appData' | 'userData' | 'temp'): Promise<{ success: boolean; data?: string }> {
    if (!this.api) return { success: false }
    return await this.api.getPath(pathName)
  }

  onTabMerge(handler: (tabData: DetachedTabData) => void): void {
    this.api?.onTabMerge?.(handler)
  }

  onTabDetached(handler: (tabData: DetachedTabData) => void): void {
    this.api?.onTabDetached?.(handler)
  }

  onFocusTabForFile(handler: (filePath: string) => void): void {
    this.api?.onFocusTabForFile?.(handler)
  }

  onViewMode(handler: (mode: string) => void): void {
    this.api?.onViewMode?.(handler)
  }

  onNewWindow(handler: () => void): void {
    this.api?.onNewWindow?.(handler)
  }

  onExternalFileChange(handler: (filePath: string) => void): void {
    this.api?.onExternalFileChange?.(handler)
  }
}

export function useElectronApi() {
  return new ElectronApiService()
}