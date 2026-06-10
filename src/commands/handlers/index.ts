// ============================================================
// Alhagi Command Handlers - 命令处理器
// ============================================================

import { getDispatcher } from '../dispatcher'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { electronService } from '@/services/electron/ElectronService'
import { useTabService } from '@/services/tabService'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { eventBus, AppEvents } from '@/events/eventBus'

// 初始化所有命令处理器
export function initCommandHandlers(): void {
  const dispatcher = getDispatcher()
  const editorManager = useCrepeEditorManager()
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const tabService = useTabService()

  // ========================================
  // 文件操作命令
  // ========================================

  dispatcher.register('file.new', () => {
    tabsStore.createTab({ title: '未命名' })
  })

  dispatcher.register('file.open', () => {
    tabService.openFile()
  })

  dispatcher.register('file.openFolder', async () => {
    const api = electronService.getAPI()
    if (api) {
      await api.openFolder()
    }
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

  dispatcher.register('file.close', () => {
    if (tabsStore.activeTabId) {
      // 脏文件确认关闭
      const tab = tabsStore.tabs.get(tabsStore.activeTabId)
      if (tab?.isDirty) {
        if (confirm('文件有未保存的更改，确定要关闭吗？')) {
          tabsStore.removeTab(tabsStore.activeTabId)
        }
      } else {
        tabsStore.removeTab(tabsStore.activeTabId)
      }
    }
  })

  // ========================================
  // 编辑操作命令
  // ========================================

  dispatcher.register('edit.undo', () => {
    // 通过 eventBus 触发：EditorContainer 会按当前模式分别处理 codemirror / crepe，
    // 直接调 editorManager.undo() 会丢失源码/分屏模式下的 codemirror undo。
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
    editorManager.toggleBold()
  })

  dispatcher.register('format.italic', () => {
    editorManager.toggleItalic()
  })

  dispatcher.register('format.strikethrough', () => {
    editorManager.toggleStrikethrough()
  })

  dispatcher.register('format.code', () => {
    editorManager.toggleInlineCode()
  })

  dispatcher.register('format.link', () => {
    editorManager.toggleLink()
  })

  dispatcher.register('format.image', () => {
    const event = new CustomEvent('editor:insertImage')
    window.dispatchEvent(event)
  })

  dispatcher.register('format.highlight', () => {
    editorManager.toggleHighlight()
  })

  // ========================================
  // 段落命令
  // ========================================

  dispatcher.register('paragraph.heading1', () => {
    editorManager.toggleHeading(1)
  })

  dispatcher.register('paragraph.heading2', () => {
    editorManager.toggleHeading(2)
  })

  dispatcher.register('paragraph.heading3', () => {
    editorManager.toggleHeading(3)
  })

  dispatcher.register('paragraph.heading4', () => {
    editorManager.toggleHeading(4)
  })

  dispatcher.register('paragraph.heading5', () => {
    editorManager.toggleHeading(5)
  })

  dispatcher.register('paragraph.heading6', () => {
    editorManager.toggleHeading(6)
  })

  dispatcher.register('paragraph.paragraph', () => {
    editorManager.toggleParagraph()
  })

  dispatcher.register('paragraph.quote', () => {
    editorManager.toggleBlockQuote()
  })

  dispatcher.register('paragraph.bulletList', () => {
    editorManager.toggleBulletList()
  })

  dispatcher.register('paragraph.orderedList', () => {
    editorManager.toggleOrderedList()
  })

  dispatcher.register('paragraph.taskList', () => {
    editorManager.toggleTaskList()
  })

  dispatcher.register('paragraph.codeBlock', () => {
    editorManager.toggleCodeFence()
  })

  dispatcher.register('paragraph.mathBlock', () => {
    editorManager.insertMathBlock()
  })

  dispatcher.register('paragraph.horizontalRule', () => {
    editorManager.insertHorizontalRule()
  })

  // ========================================
  // 表格命令
  // ========================================

  dispatcher.register('table.insert', () => {
    editorManager.insertTable()
  })

  dispatcher.register('table.insertRowAbove', () => {
    editorManager.insertTableRowAbove()
  })

  dispatcher.register('table.insertRowBelow', () => {
    editorManager.insertTableRowBelow()
  })

  dispatcher.register('table.insertColumnLeft', () => {
    editorManager.insertTableColumnLeft()
  })

  dispatcher.register('table.insertColumnRight', () => {
    editorManager.insertTableColumnRight()
  })

  dispatcher.register('table.deleteRow', () => {
    editorManager.deleteTableRow()
  })

  dispatcher.register('table.deleteColumn', () => {
    editorManager.deleteTableColumn()
  })

  // ========================================
  // 视图命令
  // ========================================

  dispatcher.register('view.toggleSidebar', () => {
    prefsStore.showSidebar = !prefsStore.showSidebar
  })

  dispatcher.register('view.toggleTabBar', () => {
    prefsStore.showTabBar = !prefsStore.showTabBar
  })

  dispatcher.register('view.toggleStatusBar', () => {
    prefsStore.showStatusBar = !prefsStore.showStatusBar
  })

  dispatcher.register('view.toggleSourceMode', () => {
    if (tabsStore.activeTabId) {
      const currentMode = tabsStore.activeTab?.viewMode
      const newMode = currentMode === 'source' ? 'wysiwyg' : 'source'
      // 通过 eventBus 转发：useApp 监听器调 tabsStore.updateTab（会触发 TAB_UPDATED），
      // 比直接 setViewMode 更完整地保留下游订阅。
      eventBus.emit(AppEvents.VIEW_MODE_CHANGE, { mode: newMode })
    }
  })

  dispatcher.register('view.wysiwygMode', () => {
    if (tabsStore.activeTabId) {
      eventBus.emit(AppEvents.VIEW_MODE_CHANGE, { mode: 'wysiwyg' })
    }
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
    // 主进程负责 setSize/setAlwaysOnTop；渲染端 prefsStore 也需要切，
    // 两条副作用分别由主进程 .window 后缀命令和这里的 store 调用各管一段。
    prefsStore.toggleStickyNoteMode()
    electronService.getAPI()?.executeMainCommand('view.stickyNoteMode.window')
  })

  dispatcher.register('view.immersiveMode', () => {
    prefsStore.toggleImmersiveMode()
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
      tabsStore.switchTab(tabOrder[nextIndex])
    }
  })

  dispatcher.register('view.prevTab', () => {
    const tabOrder = tabsStore.tabOrder
    if (tabOrder.length > 0 && tabsStore.activeTabId) {
      const currentIndex = tabOrder.indexOf(tabsStore.activeTabId)
      const prevIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length
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
