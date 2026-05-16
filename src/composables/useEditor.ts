import { ref, shallowRef, watch, type Ref } from 'vue'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { useTabsStore } from '@/stores/tabs'
import type { ViewMode, TabState, EditorInstance } from '@/types'

export function useEditor(
  containerRef: Ref<HTMLElement | null>,
  viewMode: Ref<ViewMode>
) {
  const tabsStore = useTabsStore()
  const editor = shallowRef<Editor | null>(null)
  const isReady = ref(false)
  const content = ref('')

  async function createEditor() {
    if (!containerRef.value) return

    if (editor.value) {
      await destroyEditor()
    }

    const activeTab = tabsStore.activeTab
    const initialContent = activeTab?.content || ''

    editor.value = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, containerRef.value!)
        ctx.set(defaultValueCtx, initialContent)
        
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (tabsStore.activeTab && markdown !== prevMarkdown) {
            tabsStore.updateTab(tabsStore.activeTab.id, {
              content: markdown,
              isDirty: true
            })
            content.value = markdown
          }
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .create()

    isReady.value = true
    content.value = initialContent

    setupEditorAPI()
  }

  function setupEditorAPI() {
    if (!editor.value) return

    const editorInstance: EditorInstance = {
      id: tabsStore.activeTabId || '',
      content: content.value,
      mode: viewMode.value,
      getContent: () => {
        if (!editor.value) return content.value
        try {
          const root = editor.value.action((ctx) => ctx.get(rootCtx))
          return root instanceof HTMLElement ? root.innerText || root.textContent || '' : content.value
        } catch {
          return content.value
        }
      },
      setContent: (newContent: string) => {
        if (!editor.value) return
        try {
          const root = editor.value.action((ctx) => ctx.get(rootCtx))
          if (root instanceof HTMLElement) {
            root.innerText = newContent
            content.value = newContent
          }
        } catch (e) {
          console.error('Failed to set content:', e)
        }
      },
      getCursor: () => {
        return tabsStore.activeTab?.cursor || { from: 0, to: 0 }
      },
      setCursor: (from: number, to: number) => {
        if (tabsStore.activeTabId) {
          tabsStore.updateTab(tabsStore.activeTabId, {
            cursor: { from, to }
          })
        }
      },
      getScrollTop: () => {
        return containerRef.value?.scrollTop || 0
      },
      setScrollTop: (position: number) => {
        if (containerRef.value) {
          containerRef.value.scrollTop = position
        }
      },
      focus: () => {
        containerRef.value?.focus()
      },
      destroy: async () => {
        await destroyEditor()
      }
    }
    
    window.editorInstance = editorInstance
  }

  async function destroyEditor() {
    if (editor.value) {
      await editor.value.destroy()
      editor.value = null
      isReady.value = false
    }
  }

  async function switchToTab(tab: TabState) {
    if (!editor.value) {
      await createEditor()
      return
    }

    const currentTab = tabsStore.activeTab
    if (currentTab) {
      currentTab.content = content.value
      currentTab.scrollTop = containerRef.value?.scrollTop || 0
      currentTab.cursor = { from: 0, to: 0 }
    }

    content.value = tab.content
    
    try {
      const root = editor.value.action((ctx) => ctx.get(rootCtx))
      if (root instanceof HTMLElement) {
        root.innerText = tab.content
      }
      
      if (tab.scrollTop && containerRef.value) {
        containerRef.value.scrollTop = tab.scrollTop
      }
    } catch (e) {
      console.error('Failed to switch to tab:', e)
    }

    setupEditorAPI()
  }

  function updateViewMode(mode: ViewMode) {
    viewMode.value = mode
    if (tabsStore.activeTabId) {
      tabsStore.setViewMode(tabsStore.activeTabId, mode)
    }
  }

  watch(containerRef, async (newContainer) => {
    if (newContainer && !editor.value) {
      await createEditor()
    }
  })

  return {
    editor,
    isReady,
    content,
    createEditor,
    destroyEditor,
    switchToTab,
    updateViewMode
  }
}
