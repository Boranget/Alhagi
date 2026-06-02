// ============================================================
// Alhagi Command Handlers - 命令处理器
// ============================================================

import { getDispatcher } from '../dispatcher'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { electronService } from '@/services/electron/ElectronService'

// 初始化所有命令处理器
export function initCommandHandlers(): void {
  const dispatcher = getDispatcher()
  const editorManager = useCrepeEditorManager()
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()

  // ========================================
  // 文件操作命令
  // ========================================

  dispatcher.register('file.new', () => {
    tabsStore.createTab({ title: '未命名' })
  })

  dispatcher.register('file.open', () => {
    tabsStore.openFile()
  })

  dispatcher.register('file.openFolder', async () => {
    const api = electronService.getAPI()
    if (api) {
      await api.openFolder()
    }
  })

  dispatcher.register('file.save', () => {
    if (tabsStore.activeTabId) {
      tabsStore.saveFile(tabsStore.activeTabId)
    }
  })

  dispatcher.register('file.saveAs', () => {
    if (tabsStore.activeTabId) {
      tabsStore.saveFileAs(tabsStore.activeTabId)
    }
  })

  dispatcher.register('file.close', () => {
    if (tabsStore.activeTabId) {
      tabsStore.removeTab(tabsStore.activeTabId)
    }
  })

  // ========================================
  // 编辑操作命令
  // ========================================

  dispatcher.register('edit.undo', () => {
    editorManager.undo()
  })

  dispatcher.register('edit.redo', () => {
    editorManager.redo()
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
      tabsStore.setViewMode(tabsStore.activeTabId, newMode)
    }
  })

  dispatcher.register('view.toggleTheme', () => {
    prefsStore.toggleLightDark()
  })

  dispatcher.register('view.zoomIn', () => {
    if (prefsStore.zoom < 200) {
      prefsStore.zoom += 10
    }
  })

  dispatcher.register('view.zoomOut', () => {
    if (prefsStore.zoom > 50) {
      prefsStore.zoom -= 10
    }
  })

  dispatcher.register('view.resetZoom', () => {
    prefsStore.zoom = 100
  })

  dispatcher.register('view.fullscreen', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  })

  dispatcher.register('view.stickyNoteMode', () => {
    prefsStore.toggleStickyNoteMode()
  })

  dispatcher.register('view.immersiveMode', () => {
    prefsStore.toggleImmersiveMode()
  })

  // ========================================
  // 工具命令
  // ========================================

  dispatcher.register('tools.preferences', () => {
    const event = new CustomEvent('app:openSettings')
    window.dispatchEvent(event)
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
    const event = new CustomEvent('app:captureScreen')
    window.dispatchEvent(event)
  })

  // ========================================
  // 帮助命令
  // ========================================

  dispatcher.register('help.shortcuts', () => {
    const event = new CustomEvent('app:showShortcuts')
    window.dispatchEvent(event)
  })

  dispatcher.register('help.about', () => {
    const event = new CustomEvent('app:showAbout')
    window.dispatchEvent(event)
  })
}
