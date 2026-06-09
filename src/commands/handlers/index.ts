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

  dispatcher.register('help.commandPalette', () => {
    const event = new CustomEvent('app:quickOpen')
    window.dispatchEvent(event)
  })

  dispatcher.register('help.about', () => {
    const event = new CustomEvent('app:showAbout')
    window.dispatchEvent(event)
  })
}
