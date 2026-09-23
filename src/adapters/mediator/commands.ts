import type { Command, Query } from '@core/domain/ports/IMediator'

// ── Tab Commands ────────────────────────────────────────
export const TabCommands = {
  CREATE: 'tab:create',
  CLOSE: 'tab:close',
  SWITCH: 'tab:switch',
  UPDATE: 'tab:update',
  MARK_DIRTY: 'tab:markDirty',
  MARK_CLEAN: 'tab:markClean',
  SET_VIEW_MODE: 'tab:setViewMode',
  REMOVE: 'tab:remove',
} as const

export interface CreateTabPayload {
  filePath?: string
  content?: string
  title?: string
  viewMode?: string
  fileType?: string
  splitRatio?: number
}

export interface CloseTabPayload {
  tabId: string
}

export interface SwitchTabPayload {
  tabId: string
}

export interface UpdateTabPayload {
  tabId: string
  patch: Record<string, unknown>
}

export interface MarkDirtyPayload {
  tabId: string
}

export interface MarkCleanPayload {
  tabId: string
}

export interface SetViewModePayload {
  tabId: string
  mode: string
}

export interface RemoveTabPayload {
  tabId: string
}

// ── Tab Queries ─────────────────────────────────────────
export const TabQueries = {
  GET_ALL: 'tab:getAll',
  GET_BY_ID: 'tab:getById',
  GET_ACTIVE: 'tab:getActive',
  GET_DIRTY: 'tab:getDirty',
  FIND_BY_PATH: 'tab:findByPath',
  GET_COUNT: 'tab:getCount',
  GET_ORDER: 'tab:getOrder',
  HAS_OPEN_FILES: 'tab:hasOpenFiles',
  GET_ACTIVE_ID: 'tab:getActiveId',
  GET_TAB: 'tab:getTab',
} as const

// ── Preference Commands ─────────────────────────────────
export const PreferenceCommands = {
  SET: 'pref:set',
  SET_MANY: 'pref:setMany',
  ZOOM_IN: 'pref:zoomIn',
  ZOOM_OUT: 'pref:zoomOut',
  RESET_ZOOM: 'pref:resetZoom',
  TOGGLE_LIGHT_DARK: 'pref:toggleLightDark',
  TOGGLE_WORD_COUNT_DISPLAY: 'pref:toggleWordCountDisplay',
  RESET_TO_DEFAULTS: 'pref:resetToDefaults',
  ADD_RECENT_FILE: 'pref:addRecentFile',
  REMOVE_RECENT_FILE: 'pref:removeRecentFile',
  PIN_RECENT_FILE: 'pref:pinRecentFile',
  CLEAR_RECENT_FILES: 'pref:clearRecentFiles',
  ADD_RECENT_FOLDER: 'pref:addRecentFolder',
  REMOVE_RECENT_FOLDER: 'pref:removeRecentFolder',
  PIN_RECENT_FOLDER: 'pref:pinRecentFolder',
  CLEAR_RECENT_FOLDERS: 'pref:clearRecentFolders',
  SAVE_SESSION: 'pref:saveSession',
  CLEAR_SESSION: 'pref:clearSession',
} as const

// ── Preference Queries ──────────────────────────────────
export const PreferenceQueries = {
  GET: 'pref:get',
  GET_ALL: 'pref:getAll',
  GET_THEME: 'pref:getTheme',
  GET_ZOOM: 'pref:getZoom',
  GET_FONT_SIZE: 'pref:getFontSize',
  GET_LINE_HEIGHT: 'pref:getLineHeight',
  GET_WORD_COUNT_DISPLAY_TYPE: 'pref:getWordCountDisplayType',
  GET_LANGUAGE: 'pref:getLanguage',
  GET_AUTO_SAVE: 'pref:getAutoSave',
  GET_RECENT_FILES: 'pref:getRecentFiles',
  GET_RECENT_FOLDERS: 'pref:getRecentFolders',
  GET_LAST_SESSION: 'pref:getLastSession',
} as const

// ── Layout Commands ─────────────────────────────────────
export const LayoutCommands = {
  SET_SIDEBAR: 'layout:setSidebar',
  SET_TAB_BAR: 'layout:setTabBar',
  SET_STATUS_BAR: 'layout:setStatusBar',
  TOGGLE_SIDEBAR: 'layout:toggleSidebar',
  TOGGLE_TAB_BAR: 'layout:toggleTabBar',
  TOGGLE_STATUS_BAR: 'layout:toggleStatusBar',
  APPLY_WINDOW_MODE: 'layout:applyWindowMode',
  RESTORE_DEFAULTS: 'layout:restoreDefaults',
  SET_STICKY_NOTE_MODE: 'layout:setStickyNoteMode',
  SET_IMMERSIVE_MODE: 'layout:setImmersiveMode',
} as const

// ── Layout Queries ──────────────────────────────────────
export const LayoutQueries = {
  GET_SIDEBAR: 'layout:getSidebar',
  GET_TAB_BAR: 'layout:getTabBar',
  GET_STATUS_BAR: 'layout:getStatusBar',
  GET_STICKY_NOTE_MODE: 'layout:getStickyNoteMode',
  GET_IMMERSIVE_MODE: 'layout:getImmersiveMode',
  GET_ALL: 'layout:getAll',
} as const

// ── Search Commands ─────────────────────────────────────
export const SearchCommands = {
  EXECUTE: 'search:execute',
  FIND_NEXT: 'search:findNext',
  FIND_PREV: 'search:findPrev',
  REPLACE_NEXT: 'search:replaceNext',
  REPLACE_ALL: 'search:replaceAll',
  CLEAR: 'search:clear',
} as const

// ── Search Queries ──────────────────────────────────────
export const SearchQueries = {
  GET_QUERY: 'search:getQuery',
  GET_MATCHES: 'search:getMatches',
  GET_CURRENT_INDEX: 'search:getCurrentIndex',
  GET_TOTAL: 'search:getTotal',
  GET_CURRENT_MATCH: 'search:getCurrentMatch',
} as const

// ── ViewMode Commands ───────────────────────────────────
export const ViewModeCommands = {
  SET_TYPEWRITER_MODE: 'view:setTypewriterMode',
  SET_FOCUS_MODE: 'view:setFocusMode',
  TOGGLE_TYPEWRITER_MODE: 'view:toggleTypewriterMode',
  TOGGLE_FOCUS_MODE: 'view:toggleFocusMode',
} as const

// ── ViewMode Queries ────────────────────────────────────
export const ViewModeQueries = {
  GET_TYPEWRITER_MODE: 'view:getTypewriterMode',
  GET_FOCUS_MODE: 'view:getFocusMode',
} as const

// ── FileExplorer Commands ───────────────────────────────
export const FileExplorerCommands = {
  OPEN_FOLDER: 'file:openFolder',
  OPEN_FOLDER_BY_PATH: 'file:openFolderByPath',
  REFRESH_TREE: 'file:refreshTree',
  TOGGLE_FOLDER: 'file:toggleFolder',
  CREATE_FILE: 'file:createFile',
  CREATE_DIRECTORY: 'file:createDirectory',
  DELETE_FILE: 'file:deleteFile',
  RENAME_FILE: 'file:renameFile',
} as const

// ── FileExplorer Queries ────────────────────────────────
export const FileExplorerQueries = {
  GET_CURRENT_FOLDER: 'file:getCurrentFolder',
  GET_FILE_TREE: 'file:getFileTree',
  GET_IS_LOADING: 'file:getIsLoading',
  GET_ERROR: 'file:getError',
} as const

// ── Command/Query factory helpers ──────────────────────
export function createCommand<T>(type: string, payload?: unknown): Command<T> {
  return { type, payload }
}

export function createQuery<T>(type: string, payload?: unknown): Query<T> {
  return { type, payload }
}
