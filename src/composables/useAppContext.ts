// ============================================================
// AppContext — 统一业务接口 Facade
// ============================================================
//
// 组件层仅通过 useAppContext() 访问业务操作，不直接导入 Store。
// 目标：解耦组件 ↔ Store，收敛依赖方向。
//
// 依赖规则：
//   Components → useAppContext() → Stores → Services
//   （单向，无循环）
//
// 状态属性使用 storeToRefs 保持响应式；方法直接代理。

import { storeToRefs } from 'pinia'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { useEditorStore } from '@/stores/editor'
import { useSearchStore } from '@/stores/search'
import { useLayoutStore } from '@/stores/layout'
import { useViewModeStore } from '@/stores/viewMode'
import type { ViewMode } from '@/types'
import type { SearchConfig } from '@/utils/search'

export function useAppContext() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const fileStore = useFileExplorerStore()
  const editorStore = useEditorStore()
  const searchStore = useSearchStore()
  const layoutStore = useLayoutStore()
  const viewModeStore = useViewModeStore()

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
      create: (options?: { filePath?: string; content?: string; title?: string; viewMode?: ViewMode; fileType?: import('@/types').FileType; splitRatio?: number }) => tabsStore.createTab(options),
      close: (id: string) => tabsStore.removeTab(id),
      switch: (id: string) => tabsStore.switchTab(id),
      update: (id: string, updates: Partial<import('@/types').TabState>) => tabsStore.updateTab(id, updates),
      markDirty: (id: string) => tabsStore.markDirty(id),
      markClean: (id: string) => tabsStore.markClean(id),
      setViewMode: (id: string, mode: ViewMode) => tabsStore.setViewMode(id, mode),
    },

    // ── Editor ────────────────────────────────────────
    editor: {
      init: (container: HTMLElement, content?: string, tabId?: string) => editorStore.init(container, content, tabId),
      destroy: () => editorStore.destroy(),
      isReady: () => editorStore.isReady(),
      getMarkdown: () => editorStore.getMarkdown(),
      setMarkdown: (content: string) => editorStore.setMarkdown(content),
      getHTML: () => editorStore.getHTML(),
      getView: () => editorStore.getView(),
      getCrepe: () => editorStore.getCrepe(),
      getCommands: () => editorStore.getCommands(),
      setViewMode: (mode: ViewMode) => editorStore.setViewMode(mode),
      getViewMode: () => editorStore.getViewMode(),
      switchToTab: (tabId: string) => editorStore.switchToTab(tabId),
      setActiveEditor: (editor: 'crepe' | 'codemirror' | null) => editorStore.setActiveEditor(editor),
      getActiveEditor: () => editorStore.getActiveEditor(),
      onCursorChange: (handler: (from: number, to: number) => void) => editorStore.onCursorChange(handler),
      getCurrentCursorLine: () => editorStore.getCurrentCursorLine(),
      getHeadingsWithPos: () => editorStore.getHeadingsWithPos(),
      scrollToHeading: (text: string, line: number, pos?: number) => editorStore.scrollToHeading(text, line, pos),
      getCachedContent: (tabId: string) => editorStore.getCachedContent(tabId),
      setCachedContent: (tabId: string, content: string) => editorStore.setCachedContent(tabId, content),
      clearCache: () => editorStore.clearCache(),
      updateTheme: () => editorStore.updateTheme(),
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
      toggleFolder: (node: import('@/types').FileTreeNodeType) => fileStore.toggleFolder(node),
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
    viewMode: {
      typewriterMode,
      focusMode,
      toggleTypewriterMode: viewModeStore.toggleTypewriterMode,
      toggleFocusMode: viewModeStore.toggleFocusMode,
      setTypewriterMode: viewModeStore.setTypewriterMode,
      setFocusMode: viewModeStore.setFocusMode,
    },
  }
}

export type AppContext = ReturnType<typeof useAppContext>
