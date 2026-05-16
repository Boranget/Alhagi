import { ref, watch } from 'vue'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import type { ViewMode } from '@/types'
import { useTabsStore } from '@/stores/tabs'

export class EditorInstanceManager {
  private editor: Editor | null = null
  private isInitialized = false
  private isDestroyed = false
  private container: HTMLElement | null = null
  private currentTabId: string | null = null
  private onContentChangeCallback?: (content: string, tabId: string) => void
  private content: string = ''

  constructor(
    private tabsStore: ReturnType<typeof useTabsStore>,
    private onContentChange?: (content: string, tabId: string) => void,
    private onCursorChange?: (from: number, to: number, tabId: string) => void
  ) {
    this.onContentChangeCallback = onContentChange
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    if (this.isInitialized || this.isDestroyed) {
      return
    }

    this.container = container
    this.currentTabId = tabId || this.tabsStore.activeTabId
    this.content = initialContent

    this.editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, initialContent)

        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (this.currentTabId && markdown !== prevMarkdown) {
            this.content = markdown
            this.tabsStore.updateTab(this.currentTabId, {
              content: markdown,
              isDirty: true,
              lastModified: Date.now()
            })
            this.onContentChangeCallback?.(markdown, this.currentTabId)
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

  getMarkdown(): string {
    return this.content || this.tabsStore.activeTab?.content || ''
  }

  setMarkdown(content: string): void {
    if (!this.editor) return

    try {
      this.content = content
      const ctx = this.editor.ctx
      ctx.set(defaultValueCtx, content)
    } catch (e) {
      console.error('Failed to set markdown:', e)
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
        }
      })
    }
  }

  focus(): void {
    this.container?.focus()
  }

  private exposeEditorInstance(): void {
    if (!this.editor || !this.container) return

    const manager = this

    window.editorInstance = {
      id: this.currentTabId || '',
      content: '',
      mode: this.tabsStore.activeTab?.viewMode || 'wysiwyg',
      getContent: (): string => {
        return manager.getMarkdown()
      },
      setContent: (content: string): void => {
        manager.setMarkdown(content)
      },
      getCursor: (): { from: number; to: number } => {
        return manager.getSelection()
      },
      setCursor: (from: number, to: number): void => {
        manager.setSelection(from, to)
      },
      getScrollTop: (): number => {
        return manager.getScrollTop()
      },
      setScrollTop: (position: number): void => {
        manager.setScrollTop(position)
      },
      focus: (): void => {
        manager.focus()
      },
      destroy: async (): Promise<void> => {
        await this.destroy()
      }
    }
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
      this.content = this.tabsStore.activeTab?.content || ''
      currentTab.scrollTop = this.getScrollTop()
      currentTab.lastModified = Date.now()
    }

    this.tabsStore.switchTab(tabId)
    this.currentTabId = tabId
    this.content = targetTab.content
    this.setMarkdown(targetTab.content)
    this.setScrollTop(targetTab.scrollTop)

    this.exposeEditorInstance()
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

    this.container = null
    this.currentTabId = null
    this.isInitialized = false
    this.isDestroyed = true
    this.content = ''

    if (window.editorInstance) {
      delete window.editorInstance
    }
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
