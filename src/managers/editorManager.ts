import { ref, watch } from 'vue'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import type { ViewMode } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'

export class EditorInstanceManager {
  private editor: Editor | null = null
  private isInitialized = false
  private isDestroyed = false
  private container: HTMLElement | null = null
  private currentTabId: string | null = null
  private content: string = ''
  private isUpdatingContent = false

  constructor(
    private tabsStore: ReturnType<typeof useTabsStore>
  ) {}

  // ============ 私有辅助方法 - 消除代码重复 ============
  private createEditorConfig(container: HTMLElement, content: string) {
    return (ctx: unknown) => {
      const context = ctx as { set: (key: unknown, value: unknown) => void; get: (key: unknown) => unknown }
      context.set(rootCtx, container)
      context.set(defaultValueCtx, content)

      const listenerPlugin = context.get(listenerCtx) as { markdownUpdated: (cb: (ctx: unknown, markdown: string, prevMarkdown: string) => void) => void }
      listenerPlugin.markdownUpdated((_ctx: unknown, markdown: string, prevMarkdown: string) => {
        if (this.currentTabId && markdown !== prevMarkdown && !this.isUpdatingContent) {
          this.content = markdown
          this.tabsStore.updateTab(this.currentTabId, {
            content: markdown,
            isDirty: true,
            lastModified: Date.now()
          })
          eventBus.emit(AppEvents.CONTENT_CHANGED, {
            content: markdown,
            tabId: this.currentTabId
          })
        }
      })
    }
  }

  private async createEditor(container: HTMLElement, content: string): Promise<Editor> {
    return Editor.make()
      .config(this.createEditorConfig(container, content))
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .create()
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    if (this.isInitialized || this.isDestroyed) {
      return
    }

    this.container = container
    this.currentTabId = tabId || this.tabsStore.activeTabId
    this.content = initialContent

    this.editor = await this.createEditor(container, initialContent)

    this.isInitialized = true
    eventBus.emit(AppEvents.EDITOR_READY, { tabId: this.currentTabId })
  }

  getMarkdown(): string {
    return this.content || this.tabsStore.activeTab?.content || ''
  }

  async setMarkdown(content: string): Promise<void> {
    if (!this.editor || !this.isReady() || this.content === content) return

    try {
      this.isUpdatingContent = true
      this.content = content

      await this.editor.destroy()

      if (this.container && this.currentTabId) {
        this.editor = await this.createEditor(this.container, content)
      }
    } catch (e) {
      console.error('Failed to set markdown:', e)
    } finally {
      this.isUpdatingContent = false
    }
  }

  getSelection(): { from: number; to: number } {
    return this.tabsStore.activeTab?.cursor || { from: 0, to: 0 }
  }

  setSelection(from: number, to: number): void {
    if (this.tabsStore.activeTabId) {
      this.tabsStore.updateTab(this.tabsStore.activeTabId, {
        cursor: { from, to }
      })
      eventBus.emit(AppEvents.CURSOR_CHANGED, {
        from,
        to,
        tabId: this.tabsStore.activeTabId
      })
    }
  }

  getScrollTop(): number {
    return this.container?.scrollTop || 0
  }

  setScrollTop(position: number): void {
    if (this.container) {
      requestAnimationFrame(() => {
        if (this.container) {
          this.container.scrollTop = position
          eventBus.emit(AppEvents.SCROLL_CHANGED, {
            scrollTop: position,
            tabId: this.currentTabId
          })
        }
      })
    }
  }

  focus(): void {
    this.container?.focus()
  }

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

    if (currentTab && currentTab.id !== tabId) {
      currentTab.scrollTop = this.getScrollTop()
      currentTab.lastModified = Date.now()
    }

    this.tabsStore.switchTab(tabId)
    this.currentTabId = tabId
    await this.setMarkdown(targetTab.content)
    this.setScrollTop(targetTab.scrollTop)
  }

  async destroy(): Promise<void> {
    if (this.isDestroyed) return

    if (this.currentTabId) {
      const tab = this.tabsStore.tabs.get(this.currentTabId)
      if (tab) {
        tab.content = this.content
        tab.scrollTop = this.getScrollTop()
      }
    }

    if (this.editor) {
      await this.editor.destroy()
      this.editor = null
    }

    eventBus.emit(AppEvents.EDITOR_DESTROYED, { tabId: this.currentTabId })

    this.container = null
    this.currentTabId = null
    this.isInitialized = false
    this.isDestroyed = true
    this.content = ''
  }

  isReady(): boolean {
    return this.isInitialized && !this.isDestroyed && this.editor !== null
  }

  getEditor(): Editor | null {
    return this.editor
  }

  getContainer(): HTMLElement | null {
    return this.container
  }

  getCurrentTabId(): string | null {
    return this.currentTabId
  }
}

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
    const tabId = activeTab?.id

    currentMode.value = activeTab?.viewMode || 'wysiwyg'

    manager = new EditorInstanceManager(tabsStore)
    await manager.init(containerRef.value, initialContent, tabId)
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

  const getManager = (): EditorInstanceManager | null => manager

  const destroy = async () => {
    if (manager) {
      await manager.destroy()
      manager = null
      isReady.value = false
    }
  }

  watch(() => tabsStore.activeTabId, (newTabId, oldTabId) => {
    if (newTabId && newTabId !== oldTabId && manager?.isReady()) {
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
    getManager
  }
}
