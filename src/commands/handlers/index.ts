// ============================================================
// Alhagi Command Handlers - 命令处理器
// ============================================================

import { getDispatcher } from '../dispatcher'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useLayoutStore } from '@/stores/layout'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { electronService } from '@/services/electron/ElectronService'
import { useTabService } from '@/services/tabService'
import { useWritingEnhancement } from '@/adapters/composables/useWritingEnhancement'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { eventBus, AppEvents } from '@/events/eventBus'
import { getCreateTabUseCase, getCloseTabUseCase, getExecuteEditorCommandUseCase } from '@adapters/commandHandlers'

// 初始化所有命令处理器
export function initCommandHandlers(): void {
  const dispatcher = getDispatcher()
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const layoutStore = useLayoutStore()
  const fileStore = useFileExplorerStore()
  const tabService = useTabService()
  const { confirm } = useConfirmDialog()

  // Use Cases（Core Layer）
  const createTabUseCase = getCreateTabUseCase()
  const closeTabUseCase = getCloseTabUseCase()
  const executeEditorCommand = getExecuteEditorCommandUseCase()

  // ========================================
  // 文件操作命令
  // ========================================

  dispatcher.register('file.new', async () => {
    await createTabUseCase.execute({ title: '未命名' })
  })

  dispatcher.register('file.newWindow', () => {
    // 命令面板 / 快捷键路径 → 主进程；菜单 click 已直接命中
    // mainProcessCommands['file.newWindow']，不会走到这里
    electronService.getAPI()?.executeMainCommand('file.newWindow')
  })

  dispatcher.register('file.open', () => {
    tabService.openFile()
  })

  dispatcher.register('file.openFolder', async () => {
    // 所有打开文件夹入口统一走 fileExplorerStore.openFolder：
    //   1. 更新 currentFolder/fileTree
    //   2. 写最近文件夹
    //   3. emit FOLDER_OPENED → useFolderOpenHandler 自动切到侧边栏 files 页
    await fileStore.openFolder()
  })

  dispatcher.register('file.save', () => {
    if (tabsStore.activeTabId) {
      tabService.saveFile(tabsStore.activeTabId)
    }
  })

  dispatcher.register('file.saveAs', () => {
    if (tabsStore.activeTabId) {
      tabService.saveFileAs(tabsStore.activeTabId)
    }
  })

  dispatcher.register('file.close', async () => {
    const tabId = tabsStore.activeTabId
    if (!tabId) return

    const tab = tabsStore.tabs.get(tabId)
    if (tab?.isDirty) {
      const ok = await confirm({
        title: '未保存的更改',
        message: `文件 "${tab.title}" 有未保存的更改，确定要关闭吗？`,
        confirmText: '关闭',
        cancelText: '取消',
        danger: true,
      })
      if (!ok) return
    }

    await closeTabUseCase.execute(tabId)
  })

  // ========================================
  // 编辑操作命令
  // ========================================

  dispatcher.register('edit.undo', () => {
    // 通过 eventBus 触发：EditorContainer 会按当前模式分别处理 codemirror / crepe，
    // 直接调 editorManager.commands.undo() 会丢失源码/分屏模式下的 codemirror undo。
    eventBus.emit(AppEvents.EDIT_UNDO)
  })

  dispatcher.register('edit.redo', () => {
    eventBus.emit(AppEvents.EDIT_REDO)
  })

  // Windows 习惯：Ctrl+Y 等同于 redo。同样走 eventBus，让 EditorContainer 按模式分发。
  dispatcher.register('edit.redoAlt', () => {
    eventBus.emit(AppEvents.EDIT_REDO)
  })

  dispatcher.register('edit.cut', () => {
    document.execCommand('cut')
  })

  dispatcher.register('edit.copy', () => {
    document.execCommand('copy')
  })

  dispatcher.register('edit.paste', () => {
    document.execCommand('paste')
  })

  dispatcher.register('edit.selectAll', () => {
    document.execCommand('selectAll')
  })

  dispatcher.register('edit.find', () => {
    const event = new CustomEvent('editor:showSearch')
    window.dispatchEvent(event)
  })

  dispatcher.register('edit.replace', () => {
    const event = new CustomEvent('editor:showSearch', {
      detail: { showReplace: true }
    })
    window.dispatchEvent(event)
  })

  // ========================================
  // 格式化命令
  // ========================================

  dispatcher.register('format.bold', () => {
    executeEditorCommand.execute('toggleBold')
  })

  dispatcher.register('format.italic', () => {
    executeEditorCommand.execute('toggleItalic')
  })

  dispatcher.register('format.strikethrough', () => {
    executeEditorCommand.execute('toggleStrikethrough')
  })

  dispatcher.register('format.code', () => {
    executeEditorCommand.execute('toggleInlineCode')
  })

  dispatcher.register('format.link', () => {
    executeEditorCommand.execute('toggleLink')
  })

  dispatcher.register('format.image', () => {
    const event = new CustomEvent('editor:insertImage')
    window.dispatchEvent(event)
  })

  dispatcher.register('format.highlight', () => {
    executeEditorCommand.execute('toggleHighlight')
  })

  // ========================================
  // 段落命令
  // ========================================

  dispatcher.register('paragraph.heading1', () => {
    executeEditorCommand.execute('toggleHeading1')
  })

  dispatcher.register('paragraph.heading2', () => {
    executeEditorCommand.execute('toggleHeading2')
  })

  dispatcher.register('paragraph.heading3', () => {
    executeEditorCommand.execute('toggleHeading3')
  })

  dispatcher.register('paragraph.heading4', () => {
    executeEditorCommand.execute('toggleHeading4')
  })

  dispatcher.register('paragraph.heading5', () => {
    executeEditorCommand.execute('toggleHeading5')
  })

  dispatcher.register('paragraph.heading6', () => {
    executeEditorCommand.execute('toggleHeading6')
  })

  dispatcher.register('paragraph.paragraph', () => {
    executeEditorCommand.execute('toggleParagraph')
  })

  dispatcher.register('paragraph.quote', () => {
    executeEditorCommand.execute('toggleBlockQuote')
  })

  dispatcher.register('paragraph.bulletList', () => {
    executeEditorCommand.execute('toggleBulletList')
  })

  dispatcher.register('paragraph.orderedList', () => {
    executeEditorCommand.execute('toggleOrderedList')
  })

  dispatcher.register('paragraph.taskList', () => {
    executeEditorCommand.execute('toggleTaskList')
  })

  dispatcher.register('paragraph.codeBlock', () => {
    executeEditorCommand.execute('toggleCodeFence')
  })

  dispatcher.register('paragraph.mathBlock', () => {
    executeEditorCommand.execute('insertMathBlock')
  })

  dispatcher.register('paragraph.horizontalRule', () => {
    executeEditorCommand.execute('insertHorizontalRule')
  })

  // ========================================
  // 表格命令
  // ========================================

  dispatcher.register('table.insert', () => {
    executeEditorCommand.execute('insertTable')
  })

  dispatcher.register('table.insertRowAbove', () => {
    executeEditorCommand.execute('insertTableRowAbove')
  })

  dispatcher.register('table.insertRowBelow', () => {
    executeEditorCommand.execute('insertTableRowBelow')
  })

  dispatcher.register('table.insertColumnLeft', () => {
    executeEditorCommand.execute('insertTableColumnLeft')
  })

  dispatcher.register('table.insertColumnRight', () => {
    executeEditorCommand.execute('insertTableColumnRight')
  })

  dispatcher.register('table.deleteRow', () => {
    executeEditorCommand.execute('deleteTableRow')
  })

  dispatcher.register('table.deleteColumn', () => {
    executeEditorCommand.execute('deleteTableColumn')
  })

  // ========================================
  // 视图命令
  // ========================================

  dispatcher.register('view.toggleSidebar', () => {
    layoutStore.toggleSidebar()
  })

  dispatcher.register('view.toggleTabBar', () => {
    layoutStore.toggleTabBar()
  })

  dispatcher.register('view.toggleStatusBar', () => {
    layoutStore.toggleStatusBar()
  })

  function changeMarkdownViewMode(mode: 'wysiwyg' | 'source' | 'split'): void {
    const tab = tabsStore.activeTab
    if (!tab || tab.fileType !== 'editor') return

    // 通过 eventBus 转发：useApp 监听器调 tabsStore.updateTab（会触发 TAB_UPDATED），
    // 比直接 setViewMode 更完整地保留下游订阅。
    eventBus.emit(AppEvents.VIEW_MODE_CHANGE, { mode })
  }

  dispatcher.register('view.toggleSourceMode', () => {
    const currentMode = tabsStore.activeTab?.viewMode
    changeMarkdownViewMode(currentMode === 'source' ? 'wysiwyg' : 'source')
  })

  dispatcher.register('view.wysiwygMode', () => {
    changeMarkdownViewMode('wysiwyg')
  })

  dispatcher.register('view.splitMode', () => {
    changeMarkdownViewMode('split')
  })

  dispatcher.register('view.toggleTheme', () => {
    prefsStore.toggleLightDark()
  })

  dispatcher.register('view.zoomIn', () => {
    prefsStore.zoomIn()
  })

  dispatcher.register('view.zoomOut', () => {
    prefsStore.zoomOut()
  })

  dispatcher.register('view.resetZoom', () => {
    prefsStore.resetZoom()
  })

  dispatcher.register('view.fullscreen', () => {
    // 走主进程统一实现（菜单 click + 命令面板 + 快捷键三入口收敛）；
    // 非 Electron 环境下退回 DOM API
    const api = electronService.getAPI()
    if (api) {
      api.executeMainCommand('view.fullscreen')
    } else if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  })

  dispatcher.register('view.devTools', () => {
    electronService.getAPI()?.executeMainCommand('view.devTools')
  })

  dispatcher.register('view.stickyNoteMode', () => {
    // 便签模式是当前窗口范围内的临时 UI 状态：布局/排版/窗口尺寸都不写入偏好。
    const next = layoutStore.isStickyNoteMode ? 'normal' : 'sticky'
    electronService.getAPI()?.setWindowMode(next)
  })

  dispatcher.register('view.immersiveMode', () => {
    // 沉浸模式与便签模式互斥，由主进程按当前窗口更新全屏状态和菜单勾选。
    const next = layoutStore.isImmersiveMode ? 'normal' : 'immersive'
    electronService.getAPI()?.setWindowMode(next)
  })

  dispatcher.register('view.focusMode', () => {
    const { toggleFocusMode } = useWritingEnhancement()
    toggleFocusMode()
  })

  dispatcher.register('view.typewriterMode', () => {
    const { toggleTypewriterMode } = useWritingEnhancement()
    toggleTypewriterMode()
  })

  dispatcher.register('view.nextTab', () => {
    const tabOrder = tabsStore.tabOrder
    if (tabOrder.length > 0 && tabsStore.activeTabId) {
      const currentIndex = tabOrder.indexOf(tabsStore.activeTabId)
      const nextIndex = (currentIndex + 1) % tabOrder.length
      console.log(`[Commands] nextTab: idx ${currentIndex}→${nextIndex}, active=${tabsStore.activeTabId}`)
      tabsStore.switchTab(tabOrder[nextIndex])
    }
  })

  dispatcher.register('view.prevTab', () => {
    const tabOrder = tabsStore.tabOrder
    if (tabOrder.length > 0 && tabsStore.activeTabId) {
      const currentIndex = tabOrder.indexOf(tabsStore.activeTabId)
      const prevIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length
      console.log(`[Commands] prevTab: idx ${currentIndex}→${prevIndex}, active=${tabsStore.activeTabId}`)
      tabsStore.switchTab(tabOrder[prevIndex])
    }
  })

  // ========================================
  // 工具命令
  // ========================================

  dispatcher.register('tools.preferences', () => {
    eventBus.emit(AppEvents.OPEN_SETTINGS)
  })

  dispatcher.register('tools.export', () => {
    const event = new CustomEvent('app:export')
    window.dispatchEvent(event)
  })

  dispatcher.register('tools.exportHTML', () => {
    const event = new CustomEvent('app:export', {
      detail: { format: 'html' }
    })
    window.dispatchEvent(event)
  })

  dispatcher.register('tools.exportPDF', () => {
    const event = new CustomEvent('app:export', {
      detail: { format: 'pdf' }
    })
    window.dispatchEvent(event)
  })

  dispatcher.register('tools.captureScreen', () => {
    // useApp 中已订阅 AppEvents.CAPTURE_SCREEN，由它弹出截图操作 prompt
    eventBus.emit(AppEvents.CAPTURE_SCREEN)
  })

  // ========================================
  // 帮助命令
  // ========================================

  dispatcher.register('help.shortcuts', () => {
    eventBus.emit(AppEvents.SHOW_SHORTCUTS)
  })

  dispatcher.register('help.commandPalette', () => {
    eventBus.emit(AppEvents.SHOW_COMMAND_PALETTE)
  })

  dispatcher.register('help.about', () => {
    // 走主进程显示原生 dialog（mainProcessCommands['help.about']）
    electronService.getAPI()?.executeMainCommand('help.about')
  })
}
