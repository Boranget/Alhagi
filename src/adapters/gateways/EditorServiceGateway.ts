// ============================================================
// EditorServiceGateway — 编辑器服务网关（薄代理）
// ============================================================
//
// 委托给 MilkdownAdapter，不包含任何 Milkdown 特定逻辑。
// 实现 IEditorProvider 接口。
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { IEditorCommands } from '@core/domain/ports/IEditorCommands'
import type { ViewMode } from '@shared/types'
import type { SearchService } from '@/services/search/types'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'

export interface EditorServiceGatewayDeps {
  adapter: IEditorProvider
  /** 组合根提供：事件桥接时把池级回调对齐到当前活动 tab */
  getActiveTabId: () => string | null
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

  getScrollContainer(): HTMLElement | null {
    return this.adapter.getScrollContainer()
  }

  getCursorViewportY(): number | null {
    return this.adapter.getCursorViewportY()
  }

  setEditorFocusMode(enabled: boolean): void {
    return this.adapter.setEditorFocusMode(enabled)
  }

  getActiveEditor(): 'crepe' | 'codemirror' | null {
    return this.adapter.getActiveEditor()
  }

  getCommands(): IEditorCommands {
    return this.adapter.getCommands()
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

  // 历史 / 焦点 / 选区
  undo(): void {
    return this.adapter.undo()
  }

  redo(): void {
    return this.adapter.redo()
  }

  focus(): void {
    return this.adapter.focus()
  }

  selectAll(): void {
    return this.adapter.selectAll()
  }

  insertText(text: string): void {
    return this.adapter.insertText(text)
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

/**
 * 池级回调 → 事件总线的唯一桥接点（打字机对齐、光标持久化、搜索高亮
 * 都订阅这些事件）。做在组合根而非组件挂载里：EditorContainer 卸载/重建
 * 不再影响事件流，且 gateway 存在即桥接存在，无法漏配。
 */
function bridgeEditorEvents(provider: IEditorProvider, getActiveTabId: () => string | null): void {
  const bus = useEventBusGateway()

  provider.onCursorChange((from, to) => {
    const tabId = getActiveTabId()
    if (!tabId) return
    bus.emit('editor:cursor:changed', { from, to, tabId })
  })

  provider.onContentChange((markdown) => {
    const tabId = getActiveTabId()
    if (!tabId) return
    bus.emit('editor:content:changed', { content: markdown, tabId })
  })
}

export function initializeEditorGateway(deps: EditorServiceGatewayDeps): void {
  if (gatewayInstance) return
  const gateway = new EditorServiceGateway(deps)
  gatewayInstance = gateway
  bridgeEditorEvents(gateway, deps.getActiveTabId)
}

export function getEditorServiceGateway(): EditorServiceGateway {
  if (!gatewayInstance) {
    throw new Error('EditorServiceGateway not initialized. Call initializeEditorGateway() first.')
  }
  return gatewayInstance
}
