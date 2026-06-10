// ============================================================
// Alhagi IPC Channels - 单一通道常量数据源
// ============================================================
//
// 命名约定：业务模块名作为前缀（file:/window:/dialog:），冒号分隔操作名。
// 所有 ipcMain.handle / ipcRenderer.invoke 的通道字符串必须来自此文件，
// 任何字面量字符串都视为 bug，必须迁移到这里。
//
// 注：preload 和 main 进程双方必须 import 同一份常量，否则会出现
// "Cannot find handler for ..." 这种运行时 IPC 静默失败。

export const IPC_CHANNELS = {
  FILE: {
    OPEN: 'file:open',
    SAVE: 'file:save',
    SAVE_AS: 'file:save-as',
    SAVE_BINARY: 'file:save-binary',
    READ: 'file:read',
    READ_BINARY: 'file:read-binary',
    OPEN_FOLDER: 'file:open-folder',
    READ_DIRECTORY: 'file:read-directory',
    CREATE: 'file:create',
    DELETE: 'file:delete',
    RENAME: 'file:rename',
    MOVE: 'file:move',
    COPY: 'file:copy',
    SEARCH_IN_DIRECTORY: 'file:search-in-directory',
    SHOW_IN_FOLDER: 'file:show-in-folder',
    GET_DOCUMENTS_DIRECTORY: 'file:get-documents-directory',
    ENSURE_DIRECTORY: 'file:ensure-directory',
    /** main → renderer：打开的文件被外部修改 / 删除（P2-10） */
    EXTERNAL_CHANGED: 'file:external-changed',
  },
  DIALOG: {
    SELECT_DIRECTORY: 'dialog:select-directory',
  },
  WINDOW: {
    MINIMIZE: 'window:minimize',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close',
    SET_ALWAYS_ON_TOP: 'window:set-always-on-top',
    OPEN_NEW_WINDOW: 'window:open-new-window',
    MERGE_TAB: 'window:merge-tab',
    GET_WINDOW_ID: 'window:get-window-id',
    LIST_WINDOWS: 'window:list-windows',
    GET_CURSOR_SCREEN_POINT: 'window:get-cursor-screen-point',
    GET_SCREEN_DISPLAY: 'window:get-screen-display',
    DRAG_START: 'window:drag-start',
    DRAG_END: 'window:drag-end',
    OPEN_DEV_TOOLS: 'window:open-dev-tools',
    FOCUS_WINDOW: 'window:focus-window',
    CHECK_FILE_OPEN: 'window:check-file-open',
    UPDATE_OPENED_FILES: 'window:update-opened-files',
    SET_ZOOM: 'window:set-zoom',
    SET_THEME: 'window:set-theme',
  },
  /**
   * Tab 跨窗口操作的通知通道（main → renderer 单向广播）。
   * 历史遗留：未加业务前缀，保留以避免破坏已序列化的状态。
   */
  TAB: {
    MERGE: 'tab:merge',
    DETACHED: 'tab:detached',
    FOCUS_FOR_FILE: 'focus-tab-for-file',
  },
  /**
   * 用户偏好持久化通道。
   * 数据存储到主进程的 electron-store（用户数据目录），
   * 替代旧的 localStorage 方案——多窗口可同源、不会被浏览器清缓存清掉。
   */
  PREFERENCES: {
    GET_ALL: 'preferences:get-all',
    SET_ALL: 'preferences:set-all',
  },
  /**
   * 命令系统统一执行通道（P2-12 引入）。
   * EXECUTE：main → renderer 单向通知，让渲染端 executeCommand(commandId) 派发。
   *   菜单 click、未来的全局快捷键转发、其他主进程触发的命令都走这一条。
   * EXECUTE_MAIN：renderer → main，让主进程执行 mainProcessCommands 表中的命令
   *   （如 view.fullscreen / view.devTools / view.stickyNoteMode.window 等只能主进程做的命令），
   *   命令面板/快捷键触发时与菜单点击走同一份主进程实现。
   */
  COMMAND: {
    EXECUTE: 'command:execute',
    EXECUTE_MAIN: 'command:execute-main',
  },
  /**
   * 应用菜单管理通道（P2-12 引入）。
   * REBUILD：renderer → main 通知主进程按当前语言重建原生菜单，
   * 由语言切换、命令注册表变更等场景触发。
   */
  MENU: {
    REBUILD: 'menu:rebuild',
  },
} as const
