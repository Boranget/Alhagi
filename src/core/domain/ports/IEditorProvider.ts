// ============================================================
// IEditorProvider — 编辑器提供者端口
// ============================================================
//
// 定义编辑器的完整业务能力，不暴露任何框架特定类型（Milkdown/Crepe/ProseMirror）。
// 所有实现（MilkdownAdapter, CodeMirrorAdapter 等）必须实现此接口。
//
// 依赖规则：Domain Layer 定义，Infrastructure Layer 实现，Application Layer 依赖。

import type { ViewMode } from '@shared/types'
import type { SearchService } from '@/services/search/types'

// ============================================================
// 值对象（内联定义，避免循环依赖）
// ============================================================

export interface Selection {
  from: number
  to: number
}

export interface Heading {
  text: string
  level: number
  line: number
  pos: number
}

// ============================================================
// 端口接口
// ============================================================

export interface IEditorProvider {
  // ------------------------------------------------------------------
  // 生命周期
  // ------------------------------------------------------------------

  /** 初始化编辑器 wrapper 容器 */
  initWrapper(wrapper: HTMLElement): Promise<void>

  /** 解绑 wrapper 容器，销毁所有编辑器实例并清理状态 */
  detach(): Promise<void>

  /** 销毁所有编辑器实例 */
  destroy(): Promise<void>

  /** 编辑器是否已就绪 */
  isReady(tabId?: string): boolean

  // ------------------------------------------------------------------
  // Tab 管理（多实例）
  // ------------------------------------------------------------------

  /** 创建新 tab 的编辑器实例 */
  createTab(tabId: string, content: string, viewMode?: ViewMode): Promise<void>

  /** 销毁指定 tab 的编辑器实例 */
  destroyTab(tabId: string): Promise<void>

  /** 切换到指定 tab（显示/隐藏） */
  switchTab(tabId: string): void

  /** 检查指定 tab 是否有编辑器实例 */
  hasTab(tabId: string): boolean

  // ------------------------------------------------------------------
  // 内容操作
  // ------------------------------------------------------------------

  /** 获取当前 Markdown 内容 */
  getMarkdown(tabId?: string): string

  /** 获取当前 HTML 内容 */
  getHTML(tabId?: string): string

  // ------------------------------------------------------------------
  // 视图模式
  // ------------------------------------------------------------------

  /** 设置视图模式 */
  setViewMode(mode: ViewMode): void

  /** 设置指定 tab 的视图模式 */
  setTabViewMode(tabId: string, mode: ViewMode): void

  /** 获取当前视图模式 */
  getViewMode(): ViewMode

  // ------------------------------------------------------------------
  // 导航
  // ------------------------------------------------------------------

  /** 滚动到指定标题位置 */
  scrollToHeading(pos: number): void

  // ------------------------------------------------------------------
  // 事件订阅
  // ------------------------------------------------------------------

  /** 订阅内容变更事件 */
  onContentChange(callback: (markdown: string) => void): () => void

  /** 订阅光标/选区变更事件 */
  onCursorChange(callback: (from: number, to: number) => void): () => void

  // ------------------------------------------------------------------
  // 状态查询
  // ------------------------------------------------------------------

  /** 获取当前选区 */
  getSelection(): Selection | null

  /** 获取所有标题列表 */
  getHeadings(): Heading[]

  /** 获取当前活跃编辑器类型（用于滚动服务判断容器） */
  getActiveEditor(): 'crepe' | 'codemirror' | null

  /** 获取编辑器视图实例（用于搜索、打字机模式等需要底层视图访问的场景） */
  getView(): any | null

  // ------------------------------------------------------------------
  // 搜索
  // ------------------------------------------------------------------

  /** 获取 CodeMirror 搜索服务（用于源码模式） */
  getCMSearchService(tabId?: string): SearchService | null

  // ------------------------------------------------------------------
  // 主题
  // ------------------------------------------------------------------

  /** 更新所有编辑器实例的主题 */
  updateTheme(isDark: boolean): Promise<void>

  // ------------------------------------------------------------------
  // 向后兼容（旧接口，逐步废弃）
  // ------------------------------------------------------------------

  /** @deprecated 使用 createTab + switchTab 替代 */
  init(container: HTMLElement, content: string, tabId: string): Promise<void>

  /** @deprecated 使用 setTabViewMode 替代 */
  setCurrentTabId(tabId: string): void

  /** @deprecated 每个 tab 独立管理内容，无需全局设置 */
  setMarkdown(content: string): Promise<void>

  // ------------------------------------------------------------------
  // 缓存管理
  // ------------------------------------------------------------------

  /** 获取指定 tab 的缓存内容 */
  getCachedContent(tabId: string): string | undefined

  /** 设置指定 tab 的缓存内容 */
  setCachedContent(tabId: string, content: string): void

  /** 清空所有缓存 */
  clearCache(): void
}