// ============================================================
// Alhagi MenuBuilder - 应用菜单构建
// ============================================================

import { Menu, dialog, type MenuItemConstructorOptions } from 'electron'
import { MENU_EVENTS } from '../../electron-protocol'
import type { WindowManager } from './WindowManager'

export class MenuBuilder {
  constructor(private windowManager: WindowManager) {}

  install(): void {
    Menu.setApplicationMenu(Menu.buildFromTemplate(this.buildTemplate()))
  }

  /** 给主窗口发菜单事件（注意：未来支持多窗口时这里要改成路由到 focused window） */
  private send(channel: string, ...args: unknown[]): void {
    this.windowManager.getMainWindow()?.webContents.send(channel, ...args)
  }

  private buildTemplate(): MenuItemConstructorOptions[] {
    return [
      this.buildFileMenu(),
      this.buildEditMenu(),
      this.buildParagraphMenu(),
      this.buildTableMenu(),
      this.buildViewMenu(),
      this.buildToolsMenu(),
      this.buildHelpMenu(),
    ]
  }

  private buildFileMenu(): MenuItemConstructorOptions {
    return {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => this.send(MENU_EVENTS.NEW_FILE) },
        { label: '新建窗口', accelerator: 'CmdOrCtrl+Shift+N', click: () => this.send(MENU_EVENTS.NEW_WINDOW) },
        { label: '打开', accelerator: 'CmdOrCtrl+O', click: () => this.send(MENU_EVENTS.OPEN_FILE) },
        { label: '打开文件夹', click: () => this.send(MENU_EVENTS.OPEN_FOLDER) },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => this.send(MENU_EVENTS.SAVE) },
        { label: '另存为', accelerator: 'CmdOrCtrl+Shift+S', click: () => this.send(MENU_EVENTS.SAVE_AS) },
        { type: 'separator' },
        { label: '导出', click: () => this.send(MENU_EVENTS.TOOLS_EXPORT) },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    }
  }

  private buildEditMenu(): MenuItemConstructorOptions {
    return {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => this.send(MENU_EVENTS.EDIT_UNDO) },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: () => this.send(MENU_EVENTS.EDIT_REDO) },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { type: 'separator' },
        { label: '复制为 Markdown', click: () => this.send(MENU_EVENTS.COPY_AS_MARKDOWN) },
        { label: '复制为 HTML', click: () => this.send(MENU_EVENTS.COPY_AS_HTML) },
        { label: '粘贴为纯文本', click: () => this.send(MENU_EVENTS.PASTE_AS_PLAIN) },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        { label: '查找', accelerator: 'CmdOrCtrl+F', click: () => this.send(MENU_EVENTS.EDIT_FIND) },
      ],
    }
  }

  private buildParagraphMenu(): MenuItemConstructorOptions {
    return {
      label: '段落',
      submenu: [
        { label: '标题 1', accelerator: 'CmdOrCtrl+1', click: () => this.send(MENU_EVENTS.PARAGRAPH_HEADING1) },
        { label: '标题 2', accelerator: 'CmdOrCtrl+2', click: () => this.send(MENU_EVENTS.PARAGRAPH_HEADING2) },
        { label: '标题 3', accelerator: 'CmdOrCtrl+3', click: () => this.send(MENU_EVENTS.PARAGRAPH_HEADING3) },
        { label: '段落', accelerator: 'CmdOrCtrl+0', click: () => this.send(MENU_EVENTS.PARAGRAPH_PARAGRAPH) },
        { type: 'separator' },
        { label: '引用', accelerator: 'CmdOrCtrl+Alt+Q', click: () => this.send(MENU_EVENTS.PARAGRAPH_QUOTE) },
        { label: '无序列表', accelerator: 'CmdOrCtrl+Alt+U', click: () => this.send(MENU_EVENTS.PARAGRAPH_BULLET_LIST) },
        { label: '有序列表', accelerator: 'CmdOrCtrl+Alt+O', click: () => this.send(MENU_EVENTS.PARAGRAPH_ORDERED_LIST) },
        { label: '任务列表', accelerator: 'CmdOrCtrl+Alt+X', click: () => this.send(MENU_EVENTS.PARAGRAPH_TASK_LIST) },
        { type: 'separator' },
        { label: '代码块', accelerator: 'CmdOrCtrl+Alt+C', click: () => this.send(MENU_EVENTS.PARAGRAPH_CODE_BLOCK) },
        { label: '数学公式', accelerator: 'CmdOrCtrl+Alt+M', click: () => this.send(MENU_EVENTS.PARAGRAPH_MATH_BLOCK) },
        { label: '分割线', accelerator: 'CmdOrCtrl+Alt+-', click: () => this.send(MENU_EVENTS.PARAGRAPH_HORIZONTAL_RULE) },
      ],
    }
  }

  private buildTableMenu(): MenuItemConstructorOptions {
    return {
      label: '表格',
      submenu: [
        { label: '插入表格', accelerator: 'CmdOrCtrl+Alt+T', click: () => this.send(MENU_EVENTS.TABLE_INSERT) },
        { type: 'separator' },
        { label: '上方插入行', click: () => this.send(MENU_EVENTS.TABLE_INSERT_ROW_ABOVE) },
        { label: '下方插入行', click: () => this.send(MENU_EVENTS.TABLE_INSERT_ROW_BELOW) },
        { label: '删除行', click: () => this.send(MENU_EVENTS.TABLE_DELETE_ROW) },
        { type: 'separator' },
        { label: '左侧插入列', click: () => this.send(MENU_EVENTS.TABLE_INSERT_COLUMN_LEFT) },
        { label: '右侧插入列', click: () => this.send(MENU_EVENTS.TABLE_INSERT_COLUMN_RIGHT) },
        { label: '删除列', click: () => this.send(MENU_EVENTS.TABLE_DELETE_COLUMN) },
      ],
    }
  }

  private buildViewMenu(): MenuItemConstructorOptions {
    return {
      label: '视图',
      submenu: [
        { label: 'WYSIWYG 模式', click: () => this.send(MENU_EVENTS.VIEW_MODE, 'wysiwyg') },
        { label: '源码模式', click: () => this.send(MENU_EVENTS.VIEW_MODE, 'source') },
        { label: '分屏模式', click: () => this.send(MENU_EVENTS.VIEW_MODE, 'split') },
        { type: 'separator' },
        { label: '显示/隐藏侧边栏', accelerator: 'CmdOrCtrl+B', click: () => this.send(MENU_EVENTS.TOGGLE_SIDEBAR) },
        { label: '显示/隐藏标签栏', click: () => this.send(MENU_EVENTS.TOGGLE_TAB_BAR) },
        { label: '显示/隐藏状态栏', click: () => this.send(MENU_EVENTS.TOGGLE_STATUS_BAR) },
        { type: 'separator' },
        {
          label: '悬浮便签模式',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            const win = this.windowManager.getMainWindow()
            if (!win) return
            const currentSize = win.getSize()
            const isSmall = currentSize[0] <= 400 && currentSize[1] <= 500
            if (isSmall) {
              win.setSize(1200, 800)
              win.setAlwaysOnTop(false)
            } else {
              win.setSize(350, 450)
              win.setAlwaysOnTop(true)
            }
            win.webContents.send(MENU_EVENTS.TOGGLE_STICKY_NOTE)
          },
        },
        { label: '沉浸式写作模式', accelerator: 'CmdOrCtrl+Shift+Enter', click: () => this.send(MENU_EVENTS.TOGGLE_IMMERSIVE) },
        { type: 'separator' },
        { label: '暗色模式', accelerator: 'CmdOrCtrl+Shift+D', click: () => this.send(MENU_EVENTS.TOGGLE_THEME) },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', click: () => this.send(MENU_EVENTS.ZOOM_IN) },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => this.send(MENU_EVENTS.ZOOM_OUT) },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => this.send(MENU_EVENTS.ZOOM_RESET) },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            const win = this.windowManager.getMainWindow()
            if (!win) return
            if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools()
            else win.webContents.openDevTools()
          },
        },
        { type: 'separator' },
        {
          label: '全屏',
          accelerator: 'F11',
          click: () => {
            const win = this.windowManager.getMainWindow()
            if (win) win.setFullScreen(!win.isFullScreen())
          },
        },
        {
          label: '打印',
          accelerator: 'CmdOrCtrl+P',
          click: () => this.windowManager.getMainWindow()?.webContents.print(),
        },
      ],
    }
  }

  private buildToolsMenu(): MenuItemConstructorOptions {
    return {
      label: '工具',
      submenu: [
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => this.send(MENU_EVENTS.TOOLS_PREFERENCES) },
        { label: '快捷键列表', accelerator: 'CmdOrCtrl+Shift+K', click: () => this.send(MENU_EVENTS.HELP_SHORTCUTS) },
        { type: 'separator' },
        { label: '截图', click: () => this.send(MENU_EVENTS.CAPTURE_SCREEN) },
      ],
    }
  }

  private buildHelpMenu(): MenuItemConstructorOptions {
    return {
      label: '帮助',
      submenu: [
        { label: '快捷键列表', accelerator: 'CmdOrCtrl+Shift+K', click: () => this.send(MENU_EVENTS.HELP_SHORTCUTS) },
        { type: 'separator' },
        {
          label: '关于',
          click: () =>
            dialog.showMessageBox({
              type: 'info',
              title: '关于 顾念笔记',
              message: '顾念笔记 (Alhagi) v1.0.0',
              detail: '基于 Milkdown 的现代化 Markdown 编辑器',
            }),
        },
      ],
    }
  }
}
