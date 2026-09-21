// ============================================================
// EditorServiceGateway — 编辑器服务网关（薄代理）
// ============================================================
//
// 委托给 MilkdownAdapter，不包含任何 Milkdown 特定逻辑。
// 实现 IEditorProvider 接口。
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { ViewMode } from '@shared/types'
import type { SearchService } from '@/services/search/types'

export interface EditorServiceGatewayDeps {
  adapter: IEditorProvider
}

export class EditorServiceGateway implements IEditorProvider {
  private adapter: IEditorProvider

  constructor(deps: EditorServiceGatewayDeps) {
    this.adapter = deps.adapter
  }

  // 生命周期
  async initWrapper(wrapper: HTMLElement): Promise<void> {
    return this.adapter.initWrapper(wrapper)
  }

  async detach(): Promise<void> {
    return this.adapter.detach()
  }

  async destroy(): Promise<void> {
    return this.adapter.destroy()
  }

  isReady(tabId?: string): boolean {
    return this.adapter.isReady(tabId)
  }

  // Tab 管理（多实例）
  async createTab(tabId: string, content: string, viewMode?: ViewMode): Promise<void> {
    return this.adapter.createTab(tabId, content, viewMode)
  }

  async destroyTab(tabId: string): Promise<void> {
    return this.adapter.destroyTab(tabId)
  }

  switchTab(tabId: string): void {
    return this.adapter.switchTab(tabId)
  }

  hasTab(tabId: string): boolean {
    return this.adapter.hasTab(tabId)
  }

  // 内容操作
  getMarkdown(tabId?: string): string {
    return this.adapter.getMarkdown(tabId)
  }

  getHTML(tabId?: string): string {
    return this.adapter.getHTML(tabId)
  }

  async setTabContent(tabId: string, content: string): Promise<void> {
    return this.adapter.setTabContent(tabId, content)
  }

  // 视图模式
  setViewMode(mode: ViewMode): void {
    return this.adapter.setViewMode(mode)
  }

  setTabViewMode(tabId: string, mode: ViewMode): void {
    return this.adapter.setTabViewMode(tabId, mode)
  }

  getViewMode(): ViewMode {
    return this.adapter.getViewMode()
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.adapter.getActiveEditor()
  }

  getActiveCrepe(tabId?: string): any | null {
    return (this.adapter as any).getActiveCrepe?.(tabId) ?? null
  }

  getView(): any | null {
    return this.adapter.getView()
  }

  // 导航
  scrollToHeading(pos: number): void {
    return this.adapter.scrollToHeading(pos)
  }

  // 事件订阅
  onContentChange(callback: (markdown: string) => void): () => void {
    return this.adapter.onContentChange(callback)
  }

  onCursorChange(callback: (from: number, to: number) => void): () => void {
    return this.adapter.onCursorChange(callback)
  }

  // 状态查询
  getSelection(): { from: number; to: number } | null {
    return this.adapter.getSelection()
  }

  getHeadings(): Array<{ text: string; level: number; slug: string; line: number; pos: number }> {
    return this.adapter.getHeadings()
  }

  // 搜索服务
  getCMSearchService(tabId?: string): SearchService | null {
    return this.adapter.getCMSearchService(tabId)
  }

  // 主题
  async updateTheme(isDark: boolean): Promise<void> {
    return this.adapter.updateTheme(isDark)
  }

  // 缓存管理
  getCachedContent(tabId: string): string | undefined {
    return this.adapter.getCachedContent(tabId)
  }

  setCachedContent(tabId: string, content: string): void {
    this.adapter.setCachedContent(tabId, content)
  }

  clearCache(): void {
    this.adapter.clearCache()
  }
}

// 单例工厂（由 DI 容器管理实例）
let gatewayInstance: EditorServiceGateway | null = null

export function initializeEditorGateway(deps: EditorServiceGatewayDeps): void {
  if (gatewayInstance) return
  gatewayInstance = new EditorServiceGateway(deps)
}

export function setEditorServiceGateway(instance: EditorServiceGateway): void {
  gatewayInstance = instance
}

export function getEditorServiceGateway(): EditorServiceGateway {
  if (!gatewayInstance) {
    throw new Error('EditorServiceGateway not initialized. Call initializeEditorGateway() first.')
  }
  return gatewayInstance
}
