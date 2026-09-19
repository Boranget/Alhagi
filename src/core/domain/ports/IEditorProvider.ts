// ============================================================
// IEditorProvider — 编辑器提供者端口
// ============================================================
//
// 定义编辑器的完整业务能力，不暴露任何框架特定类型（Milkdown/Crepe/ProseMirror）。
// 所有实现（MilkdownAdapter, CodeMirrorAdapter 等）必须实现此接口。
//
// 依赖规则：Domain Layer 定义，Infrastructure Layer 实现，Application Layer 依赖。

import type { ViewMode } from '@shared/types'

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

  /** 初始化编辑器实例 */
  init(container: HTMLElement, content: string, tabId: string): Promise<void>

  /** 销毁编辑器实例 */
  destroy(): Promise<void>

  /** 编辑器是否已就绪 */
  isReady(): boolean

  // ------------------------------------------------------------------
  // 内容操作
  // ------------------------------------------------------------------

  /** 获取当前 Markdown 内容 */
  getMarkdown(): string

  /** 设置 Markdown 内容（替换全部） */
  setMarkdown(content: string): Promise<void>

  /** 获取当前 HTML 内容 */
  getHTML(): string

  // ------------------------------------------------------------------
  // 视图模式
  // ------------------------------------------------------------------

  /** 设置视图模式 */
  setViewMode(mode: ViewMode): void

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
  // 状态查询（新增）
  // ------------------------------------------------------------------

  /** 获取当前选区 */
  getSelection(): Selection | null

  /** 获取所有标题列表 */
  getHeadings(): Heading[]

  /** 获取当前活跃编辑器类型（用于滚动服务判断容器） */
  getActiveEditor(): 'crepe' | 'codemirror' | null

  /** 获取编辑器视图实例（用于搜索、打字机模式等需要底层视图访问的场景） */
  getView(): any | null
}