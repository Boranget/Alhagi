// ============================================================
// AppContext — 统一业务接口 Facade (Clean Architecture 版本)
// ============================================================
//
// 组件层仅通过 useAppContext() 访问业务操作，不直接导入 Store。
// 目标：解耦组件 ↔ Store，收敛依赖方向。
//
// 依赖规则：
//   Components → useAppContext() → Repositories/Services → Core
//   （单向，无循环）
//
// 状态属性使用 storeToRefs 保持响应式；方法通过 Use Cases 执行。

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { useEditorStore } from '@/stores/editor'
import { useSearchStore } from '@/stores/search'
import { useLayoutStore } from '@/stores/layout'
import { useViewModeStore } from '@/stores/viewMode'
import { useWritingEnhancement } from '@/adapters/composables/useWritingEnhancement'
import { useEditor } from '@/adapters/composables/useEditor'
import { getCreateTabUseCase, getCloseTabUseCase, getSwitchTabUseCase, getUpdateTabUseCase } from '@adapters/commandHandlers'
import type { ViewMode } from '@shared/types'
import type { SearchConfig } from '@/utils/search'
import type { SearchService } from '@/services/search/types'

export function useAppContext() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const fileStore = useFileExplorerStore()
  const editorStore = useEditorStore()
  const searchStore = useSearchStore()
  const layoutStore = useLayoutStore()
  const viewModeStore = useViewModeStore()
  const editor = useEditor()

  // Use Cases
  const createTabUseCase = getCreateTabUseCase()
  const closeTabUseCase = getCloseTabUseCase()
  const switchTabUseCase = getSwitchTabUseCase()
  const updateTabUseCase = getUpdateTabUseCase()

  // storeToRefs 保持 computed getters 的响应式
  const { activeTab, activeTabId, tabCount, dirtyTabs } = storeToRefs(tabsStore)
  const {
    theme, zoom, fontSize, lineHeight, wordCountDisplayType,
    autoSave, autoSaveInterval, language, showMenuBar, hideScrollBars,
    recentFiles, recentFolders, customThemes,
  } = storeToRefs(prefsStore)
  const { currentFolder, fileTree, isLoading, error: fileError } = storeToRefs(fileStore)
  const { currentQuery, currentIndex, totalMatches } = storeToRefs(searchStore)
  const {
    showSidebar, showTabBar, showStatusBar,
    isStickyNoteMode, isImmersiveMode,
  } = storeToRefs(layoutStore)

  const { typewriterMode, focusMode } = storeToRefs(viewModeStore)

  return {
    // ── Tabs ──────────────────────────────────────────
    tabs: {
      activeTab,
      activeTabId,
      tabCount,
      dirtyTabs,
      allTabs: tabsStore.getAllTabs,
      getTab: (id: string) => tabsStore.getTab(id),
      findByPath: (path: string) => tabsStore.findTabByFilePath(path),
      create: async (options?: { filePath?: string; content?: string; title?: string; viewMode?: ViewMode; fileType?: import('@shared/types').FileType; splitRatio?: number }) => {
        const tab = await createTabUseCase.execute(options)
        return tab
      },
      close: async (id: string) => {
        await closeTabUseCase.execute(id)
      },
      switch: async (id: string) => {
        await switchTabUseCase.execute(id)
      },
      update: async (id: string, updates: Partial<import('@shared/types').TabState>) => {
        await updateTabUseCase.execute(id, updates)
      },
      markDirty: (id: string) => tabsStore.markDirty(id),
      markClean: (id: string) => tabsStore.markClean(id),
      setViewMode: (id: string, mode: ViewMode) => tabsStore.setViewMode(id, mode),
    },

    // ── Editor ────────────────────────────────────────
    editor: {
      // 新的多实例 API
      initWrapper: (wrapper: HTMLElement) => editor.initWrapper(wrapper),
      detach: () => editor.detach(),
      createTab: (tabId: string, content: string, viewMode?: ViewMode) => editor.createTab(tabId, content, viewMode),
      destroyTab: (tabId: string) => editor.destroyTab(tabId),
      switchTab: (tabId: string) => editor.switchTab(tabId),
      hasTab: (tabId: string) => editor.hasTab(tabId),

      // 搜索
      getCMSearchService: (tabId?: string): SearchService | null => editor.getCMSearchService(tabId),

      // 主题
      updateTheme: (isDark: boolean) => editor.updateTheme(isDark),

      // 向后兼容的旧 API
      init: (container: HTMLElement, content: string = '', tabId: string = '') => editor.init(container, content, tabId),
      destroy: () => editor.destroy(),
      isReady: () => editor.isReady(),
      getMarkdown: () => editor.getMarkdown(),
      setMarkdown: (content: string) => editor.setMarkdown(content),
      getHTML: () => editor.getHTML(),
      setViewMode: (mode: ViewMode) => editor.setViewMode(mode),
      setTabViewMode: (tabId: string, mode: ViewMode) => editor.setTabViewMode(tabId, mode),
      getViewMode: () => editor.getViewMode(),
      getActiveEditor: () => editor.getActiveEditor(),
      onCursorChange: (handler: (from: number, to: number) => void) => editor.onCursorChange(handler),
      onContentChange: (handler: (markdown: string) => void) => editor.onContentChange(handler),
      getHeadingsWithPos: () => editorStore.getHeadingsWithPos(),
      scrollToHeading: (pos: number) => editorStore.scrollToHeading(pos),
      getCachedContent: (tabId: string) => editor.getCachedContent(tabId),
      setCachedContent: (tabId: string, content: string) => editor.setCachedContent(tabId, content),
      clearCache: () => editor.clearCache(),
      getView: () => editor.getView(),
      setCurrentTabId: (tabId: string) => editor.setCurrentTabId(tabId),
    },

    // ── Search ────────────────────────────────────────
    search: {
      currentQuery,
      currentIndex,
      totalMatches,
      search: (config: SearchConfig, options?: { select?: boolean }) => searchStore.search(config, options),
      clear: () => searchStore.clear(),
      findNext: () => searchStore.findNext(),
      findPrev: () => searchStore.findPrev(),
      replaceNext: (replacement: string) => searchStore.replaceNext(replacement),
      replaceAll: (replacement: string) => searchStore.replaceAll(replacement),
    },

    // ── File Explorer ─────────────────────────────────
    file: {
      currentFolder,
      fileTree,
      isLoading,
      error: fileError,
      openFolder: () => fileStore.openFolder(),
      openFolderByPath: (path: string) => fileStore.openFolderByPath(path),
      refreshTree: () => fileStore.refreshTree(),
      toggleFolder: (node: import('@shared/types').FileTreeNodeType) => fileStore.toggleFolder(node),
      createFile: (dirPath: string, fileName: string) => fileStore.createFile(dirPath, fileName),
      createDirectory: (dirPath: string, dirName: string) => fileStore.createDirectory(dirPath, dirName),
      deleteFile: (filePath: string) => fileStore.deleteFile(filePath),
      renameFile: (oldPath: string, newName: string) => fileStore.renameFile(oldPath, newName),
    },

    // ── Preferences ───────────────────────────────────
    prefs: {
      theme,
      zoom,
      fontSize,
      lineHeight,
      wordCountDisplayType,
      autoSave,
      autoSaveInterval,
      language,
      showMenuBar,
      hideScrollBars,
      recentFiles,
      recentFolders,
      customThemes,
      setOne: prefsStore.setOne,
      setMany: prefsStore.setMany,
      applyTheme: prefsStore.applyTheme,
      toggleLightDark: prefsStore.toggleLightDark,
      toggleWordCountDisplayType: prefsStore.toggleWordCountDisplayType,
      zoomIn: prefsStore.zoomIn,
      zoomOut: prefsStore.zoomOut,
      resetZoom: prefsStore.resetZoom,
    },

    // ── Layout ────────────────────────────────────────
    layout: {
      showSidebar,
      showTabBar,
      showStatusBar,
      isStickyNoteMode,
      isImmersiveMode,
      toggleSidebar: layoutStore.toggleSidebar,
      setSidebar: layoutStore.setSidebar,
      setTabBar: layoutStore.setTabBar,
      setStatusBar: layoutStore.setStatusBar,
      applyWindowMode: layoutStore.applyWindowMode,
      restoreDefaults: layoutStore.restoreDefaults,
    },

    // ── View Mode (typewriter / focus) ────────────────
    // 委托给 useWritingEnhancement 单例（Clean Architecture 依赖链统一）
    viewMode: {
      typewriterMode,
      focusMode,
      toggleTypewriterMode: () => {
        const { toggleTypewriterMode } = useWritingEnhancement()
        toggleTypewriterMode()
      },
      toggleFocusMode: () => {
        const { toggleFocusMode } = useWritingEnhancement()
        toggleFocusMode()
      },
      setTypewriterMode: viewModeStore.setTypewriterMode,
      setFocusMode: viewModeStore.setFocusMode,
    },
  }
}

export type AppContext = ReturnType<typeof useAppContext>