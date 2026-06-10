// ============================================================
// Alhagi Menu Events - 主进程菜单 → 渲染端的事件通道常量
// ============================================================
//
// P2-12 之后，主进程菜单点击统一走 IPC_CHANNELS.COMMAND.EXECUTE 通道，
// 由渲染端 dispatcher.executeCommand(id) 派发到命令 handler。
//
// 本表中大部分常量已无 send 方，仅作为兼容入口保留：
//   - 仍在用：TOGGLE_STICKY_NOTE（mainProcessCommands 中通知 UI 同步状态）
//   - 死常量：其余 ~50 个；preload onXxx 仍按它们订阅，但主进程不会发送。
//
// @deprecated 整张表计划在 P2-12 后续阶段（issue: cleanup-menu-events）逐步清理。

export const MENU_EVENTS = {
  // 文件
  NEW_FILE: 'menu:new-file',
  NEW_WINDOW: 'menu:new-window',
  OPEN_FILE: 'menu:open-file',
  OPEN_FOLDER: 'menu:open-folder',
  SAVE: 'menu:save',
  SAVE_AS: 'menu:save-as',

  // 编辑
  EDIT_UNDO: 'menu:edit-undo',
  EDIT_REDO: 'menu:edit-redo',
  EDIT_FIND: 'menu:edit-find',
  COPY_AS_MARKDOWN: 'menu:copy-as-markdown',
  COPY_AS_HTML: 'menu:copy-as-html',
  PASTE_AS_PLAIN: 'menu:paste-as-plain',
  CAPTURE_SCREEN: 'menu:capture-screen',

  // 段落
  PARAGRAPH_HEADING1: 'menu:paragraph-heading1',
  PARAGRAPH_HEADING2: 'menu:paragraph-heading2',
  PARAGRAPH_HEADING3: 'menu:paragraph-heading3',
  PARAGRAPH_PARAGRAPH: 'menu:paragraph-paragraph',
  PARAGRAPH_QUOTE: 'menu:paragraph-quote',
  PARAGRAPH_BULLET_LIST: 'menu:paragraph-bullet-list',
  PARAGRAPH_ORDERED_LIST: 'menu:paragraph-ordered-list',
  PARAGRAPH_TASK_LIST: 'menu:paragraph-task-list',
  PARAGRAPH_CODE_BLOCK: 'menu:paragraph-code-block',
  PARAGRAPH_MATH_BLOCK: 'menu:paragraph-math-block',
  PARAGRAPH_HORIZONTAL_RULE: 'menu:paragraph-horizontal-rule',

  // 表格
  TABLE_INSERT: 'menu:table-insert',
  TABLE_INSERT_ROW_ABOVE: 'menu:table-insert-row-above',
  TABLE_INSERT_ROW_BELOW: 'menu:table-insert-row-below',
  TABLE_INSERT_COLUMN_LEFT: 'menu:table-insert-column-left',
  TABLE_INSERT_COLUMN_RIGHT: 'menu:table-insert-column-right',
  TABLE_DELETE_ROW: 'menu:table-delete-row',
  TABLE_DELETE_COLUMN: 'menu:table-delete-column',

  // 视图
  VIEW_MODE: 'menu:view-mode',
  TOGGLE_SIDEBAR: 'menu:toggle-sidebar',
  TOGGLE_TAB_BAR: 'menu:toggle-tab-bar',
  TOGGLE_STATUS_BAR: 'menu:toggle-status-bar',
  TOGGLE_STICKY_NOTE: 'menu:toggle-sticky-note',
  TOGGLE_IMMERSIVE: 'menu:toggle-immersive',
  TOGGLE_THEME: 'menu:toggle-theme',
  ZOOM_IN: 'menu:zoom-in',
  ZOOM_OUT: 'menu:zoom-out',
  ZOOM_RESET: 'menu:zoom-reset',

  // 导航
  NAVIGATION_QUICK_OPEN: 'menu:navigation-quick-open',
  NAVIGATION_GOTO_LINE: 'menu:navigation-goto-line',

  // 工具
  TOOLS_PREFERENCES: 'menu:tools-preferences',
  TOOLS_EXPORT: 'menu:tools-export',

  // 帮助
  HELP_SHORTCUTS: 'menu:help-shortcuts',
  HELP_ABOUT: 'menu:help-about',
  OPEN_SETTINGS: 'menu:open-settings',
} as const
