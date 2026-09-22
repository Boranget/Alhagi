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
} as const

// ── Preference Commands ─────────────────────────────────
export const PreferenceCommands = {
  SET: 'preference:set',
  SET_MANY: 'preference:setMany',
  ZOOM_IN: 'preference:zoomIn',
  ZOOM_OUT: 'preference:zoomOut',
  RESET_ZOOM: 'preference:resetZoom',
  TOGGLE_LIGHT_DARK: 'preference:toggleLightDark',
} as const

// ── Preference Queries ──────────────────────────────────
export const PreferenceQueries = {
  GET: 'preference:get',
  GET_ALL: 'preference:getAll',
} as const

// ── Search Queries ──────────────────────────────────────
export const SearchQueries = {
  GET_QUERY: 'search:getQuery',
  GET_MATCHES: 'search:getMatches',
  GET_CURRENT_INDEX: 'search:getCurrentIndex',
  GET_TOTAL: 'search:getTotal',
  GET_CURRENT_MATCH: 'search:getCurrentMatch',
} as const

// ── Command factory helpers ─────────────────────────────
export function createCommand<T>(type: string, payload?: unknown): Command<T> {
  return { type, payload }
}

export function createQuery<T>(type: string, payload?: unknown): Query<T> {
  return { type, payload }
}
