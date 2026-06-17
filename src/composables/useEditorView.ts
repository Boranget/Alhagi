import { ref, computed } from 'vue'
import { EDITOR } from '@/constants'
import { useTabsStore } from '@/stores/tabs'
import type { ViewMode } from '@/types'

/**
 * 编辑器视图状态。
 *
 * currentMode / splitRatio 已改为 **per-tab** 状态：
 *   - 数据源：tabsStore.activeTab.viewMode / splitRatio
 *   - 写入：currentMode.value = x / splitRatio.value = y 会 updateTab 当前 tab
 *   - 无 activeTab（欢迎页）时回退默认值
 *
 * 这样每个 Markdown 标签页都记住自己的 wysiwyg/source/split 与分屏比例。
 */
export function useEditorView() {
  const tabsStore = useTabsStore()

  const isResizing = ref(false)
  const windowWidth = ref(window.innerWidth)
  const windowHeight = ref(window.innerHeight)

  const currentMode = computed<ViewMode>({
    get() {
      return tabsStore.activeTab?.viewMode ?? EDITOR.VIEW_MODES.WYSIWYG
    },
    set(mode) {
      const tab = tabsStore.activeTab
      if (!tab || tab.viewMode === mode) return
      tabsStore.updateTab(tab.id, { viewMode: mode })
    },
  })

  const splitRatio = computed<number>({
    get() {
      return tabsStore.activeTab?.splitRatio ?? 50
    },
    set(ratio) {
      const tab = tabsStore.activeTab
      if (!tab) return
      const next = Math.max(20, Math.min(80, ratio))
      if (tab.splitRatio === next) return
      tabsStore.updateTab(tab.id, { splitRatio: next })
    },
  })

  const isWysiwygMode = computed(() => currentMode.value === EDITOR.VIEW_MODES.WYSIWYG)
  const isSourceMode = computed(() => currentMode.value === EDITOR.VIEW_MODES.SOURCE)
  const isSplitMode = computed(() => currentMode.value === EDITOR.VIEW_MODES.SPLIT)

  const isSmallScreen = computed(() => windowWidth.value < 800)
  const editorScale = computed(() => {
    if (windowWidth.value < 600) return 0.8
    if (windowWidth.value < 1000) return 0.9
    return 1
  })

  return {
    currentMode,
    splitRatio,
    isResizing,
    windowWidth,
    windowHeight,
    isWysiwygMode,
    isSourceMode,
    isSplitMode,
    isSmallScreen,
    editorScale
  }
}
