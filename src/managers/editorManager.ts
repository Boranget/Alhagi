import { ref, shallowRef, watch, type Ref } from 'vue'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import type { TabState, ViewMode, EditorInstance as EditorInstanceType } from '@/types'
import { useTabsStore } from '@/stores/tabs'

/**
 * 编辑器实例管理器 - 单窗口单编辑器实例
 * 
 * 职责：
 * 1. 管理 Milkdown 编辑器实例的生命周期
 * 2. 处理标签页切换时的状态保存和恢复
 * 3. 提供统一的编辑器操作接口
 */
export class EditorInstanceManager {
  private editor: Editor | null = null
  private isInitialized = false
  private isDestroyed = false
  private container: HTMLElement | null = null

  constructor(
    private tabsStore: ReturnType<typeof useTabsStore>,
    private onContentChange?: (content: string, tabId: string) => void,
    private onCursorChange?: (from: number, to: number, tabId: string) => void
  ) {}

  /**
   * 初始化编辑器
   */
  async init(container: HTMLElement, initialContent: string = ''): Promise<void> {
    if (this.isInitialized || this.isDestroyed) {
      return
    }

    this.container = container
    
    this.editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, initialContent)

        ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (this.tabsStore.activeTabId && markdown !== prevMarkdown) {
            this.tabsStore.updateTab(this.tabsStore.activeTabId, {
              content: markdown,
              isDirty: true,
              lastModified: Date.now()
            })
            this.onContentChange?.(markdown, this.tabsStore.activeTabId)
          }
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .create()

    this.isInitialized = true
    this.exposeEditorInstance()
  }

  /**
   * 暴露编辑器实例到 window.editorInstance
   */
  private exposeEditorInstance(): void {
    if (!this.editor || !this.container) return

    window.editorInstance = {
      id: this.tabsStore.activeTabId || '',
      content: '',
      mode: this.tabsStore.activeTab?.viewMode || 'wysiwyg',
      getContent: (): string => {
        return this.tabsStore.activeTab?.content || ''
      },
      setContent: (content: string): void => {
        this.setContent(content)
      },
      getCursor: (): { from: number; to: number } => {
        return this.tabsStore.activeTab?.cursor || { from: 0, to: 0 }
      },
      setCursor: (from: number, to: number): void => {
        if (this.tabsStore.activeTabId) {
          this.tabsStore.updateTab(this.tabsStore.activeTabId, {
            cursor: { from, to }
          })
        }
      },
      getScrollTop: (): number => {
        return this.container?.scrollTop || 0
      },
      setScrollTop: (position: number): void => {
        if (this.container) {
          this.container.scrollTop = position
        }
      },
      focus: (): void => {
        this.container?.focus()
      },
      destroy: async (): Promise<void> => {
        await this.destroy()
      }
    }
  }

  /**
   * 切换到指定标签页
   */
  async switchToTab(tabId: string): Promise<void> {
    if (!this.editor || !this.container) {
      console.warn('Editor not initialized')
      return
    }

    const currentTab = this.tabsStore.activeTab
    const targetTab = this.tabsStore.tabs.get(tabId)

    if (!targetTab) {
      console.error('Tab not found:', tabId)
      return
    }

    // 1. 保存当前标签页状态
    if (currentTab) {
      currentTab.scrollTop = this.container.scrollTop
      currentTab.lastModified = Date.now()
    }

    // 2. 更新标签页激活状态
    this.tabsStore.switchTab(tabId)

    // 3. 恢复目标标签页状态
    this.setContent(targetTab.content)
    
    // 恢复滚动位置（下一帧，避免布局影响）
    requestAnimationFrame(() => {
      if (this.container && targetTab.scrollTop > 0) {
        this.container.scrollTop = targetTab.scrollTop
      }
    })

    // 4. 更新暴露的编辑器实例
    this.exposeEditorInstance()
  }

  /**
   * 设置编辑器内容
   */
  setContent(content: string): void {
    if (!this.editor) return

    try {
      // 重新创建编辑器（简化处理）
      this.recreateEditor(content)
    } catch (e) {
      console.error('Failed to set editor content:', e)
    }
  }

  /**
   * 重新创建编辑器（用于内容重置）
   */
  private async recreateEditor(content: string): Promise<void> {
    if (!this.container) return

    if (this.editor) {
      await this.editor.destroy()
      this.editor = null
    }

    await this.init(this.container, content)
  }

  /**
   * 获取当前内容（来自 activeTab）
   */
  getContent(): string {
    return this.tabsStore.activeTab?.content || ''
  }

  /**
   * 销毁编辑器
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) return

    if (this.editor) {
      await this.editor.destroy()
      this.editor = null
    }

    this.container = null
    this.isInitialized = false
    this.isDestroyed = true

    if (window.editorInstance) {
      delete window.editorInstance
    }
  }

  /**
   * 检查编辑器是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && !this.isDestroyed && this.editor !== null
  }

  /**
   * 获取原始编辑器实例（高级用法）
   */
  getEditor(): Editor | null {
    return this.editor
  }

  /**
   * 获取容器元素
   */
  getContainer(): HTMLElement | null {
    return this.container
  }
}

/**
 * 创建编辑器管理器组合式函数
 */
export function useEditorManager() {
  const tabsStore = useTabsStore()
  const containerRef = ref<HTMLElement | null>(null)
  const isReady = ref(false)
  const currentMode = ref<ViewMode>('wysiwyg')

  let manager: EditorInstanceManager | null = null

  const init = async () => {
    if (!containerRef.value || manager) return

    const activeTab = tabsStore.activeTab
    const initialContent = activeTab?.content || ''
    currentMode.value = activeTab?.viewMode || 'wysiwyg'

    manager = new EditorInstanceManager(tabsStore)
    await manager.init(containerRef.value, initialContent)
    isReady.value = true
  }

  const switchToTab = async (tabId: string) => {
    if (!manager) return
    const tab = tabsStore.tabs.get(tabId)
    if (tab) {
      currentMode.value = tab.viewMode
    }
    await manager.switchToTab(tabId)
  }

  const setViewMode = (mode: ViewMode) => {
    currentMode.value = mode
    if (tabsStore.activeTabId) {
      tabsStore.setViewMode(tabsStore.activeTabId, mode)
    }
  }

  const destroy = async () => {
    if (manager) {
      await manager.destroy()
      manager = null
      isReady.value = false
    }
  }

  // 监听 activeTab 变化，自动切换
  watch(() => tabsStore.activeTabId, (newTabId, oldTabId) => {
    if (newTabId && newTabId !== oldTabId) {
      switchToTab(newTabId)
    }
  })

  return {
    containerRef,
    isReady,
    currentMode,
    init,
    switchToTab,
    setViewMode,
    destroy,
    getManager: () => manager
  }
}
