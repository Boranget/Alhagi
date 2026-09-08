// ============================================================
// Preferences Store — Single-Writer 模式（仿 Muya）
// ============================================================
//
// 不变量：
//   1. 渲染端永远不直接写本地 ref —— 只暴露 `setOne(key, value)` action，
//      内部仅 IPC，不动本地 ref；
//   2. 本地 ref 的唯一写入路径是主进程的 PREFERENCES.CHANGED 广播 → applyPatch；
//   3. 所有副作用（applyTheme / setI18nLanguage / setZoom / CSS 变量 / 写盘）
//      都挂在 ref 的 watch 上；single-writer 保证它们必然被触发。
//
// 这样从架构上一次性消除了：
//   - v-model 直绑 ref 绕过副作用
//   - updatePreferences 批量灌入引发 N 次 IPC 风暴
//   - reactive proxy 经过 structured-clone 卡 IPC
//   - 跨窗口广播回写循环 + isApplyingBroadcast 闸门
//   - 多窗口短暂状态不一致

import { defineStore } from 'pinia'
import { ref, watch, type Ref } from 'vue'
import type { RecentFile, RecentFolder } from '@/types'
import { useErrorStore, ErrorCode, ErrorSeverity } from '@/stores/error'
import { UI, EDITOR, AUTO_SAVE, I18N, IMAGE, LAUNCH } from '@/constants'
import { useThemeService } from '@/services/theme/ThemeService'
import { useRecentFilesService } from '@/services/recentFiles/RecentFilesService'
import { setLanguage as setI18nLanguage } from '@/services/i18n'
import { eventBus, AppEvents } from '@/events/eventBus'

export interface Preferences {
  launchMode: 'last-session' | 'welcome' | 'empty' | 'folder'
  launchFolderPath?: string
  autoSave: boolean
  autoSaveInterval: number
  theme: 'light' | 'dark' | 'system' | string
  showMenuBar: boolean
  hideScrollBars: boolean
  isStickyNoteMode: boolean
  isImmersiveMode: boolean
  fontSize: number
  lineHeight: number
  sourceFontSize: number
  sourceLineHeight: number
  zoom: number
  wordWrap: boolean
  imageInsertMode: 'keep-original' | 'copy-absolute' | 'copy-relative'
  imageStoragePath: string
  language: 'zh-CN' | 'en'
  devToolsOnStartup: boolean
  openFileInNewWindow: boolean
  openFolderInNewWindow: boolean
  lineEnding: 'lf' | 'crlf'
  recentFiles: RecentFile[]
  maxRecentFiles: number
  recentFolders: RecentFolder[]
  maxRecentFolders: number
  customThemePath: string
  customThemes: CustomTheme[]
  wordCountDisplayType: 'raw' | 'rendered'
  lastSession?: {
    tabs: Array<{
      title: string
      content: string
      filePath: string | null
      viewMode: string
      splitRatio?: number
      isDirty: boolean
      cursor: { from: number; to: number }
    }>
    activeTabId?: string
    currentFolder?: string
  }
}

export interface CustomTheme {
  id: string
  name: string
  path: string
  colors: ThemeColors
}

export interface ThemeColors {
  '--bg-primary': string
  '--bg-secondary': string
  '--text-primary': string
  '--text-secondary': string
  '--border-color': string
  '--primary-color': string
  '--sidebar-bg': string
  '--sidebar-hover-bg': string
  '--input-bg': string
}

const DEFAULT_PREFERENCES: Preferences = {
  launchMode: LAUNCH.MODES.WELCOME,
  launchFolderPath: '',
  autoSave: true,
  autoSaveInterval: AUTO_SAVE.DEFAULT_INTERVAL,
  theme: UI.THEMES.LIGHT,
  showMenuBar: true,
  hideScrollBars: false,
  isStickyNoteMode: false,
  isImmersiveMode: false,
  fontSize: EDITOR.DEFAULT_FONT_SIZE,
  lineHeight: EDITOR.DEFAULT_LINE_HEIGHT,
  sourceFontSize: EDITOR.DEFAULT_SOURCE_FONT_SIZE,
  sourceLineHeight: EDITOR.DEFAULT_SOURCE_LINE_HEIGHT,
  zoom: 100,
  wordWrap: true,
  imageInsertMode: IMAGE.INSERT_MODES.KEEP_ORIGINAL,
  imageStoragePath: '',
  language: I18N.DEFAULT_LANGUAGE,
  devToolsOnStartup: false,
  openFileInNewWindow: false,
  openFolderInNewWindow: false,
  lineEnding: 'lf' as const,
  recentFiles: [],
  maxRecentFiles: 20,
  recentFolders: [],
  maxRecentFolders: 10,
  customThemePath: '',
  customThemes: [],
  wordCountDisplayType: 'raw',
  lastSession: undefined
}

const STORAGE_KEY = 'alhagi-preferences'

export const usePreferencesStore = defineStore('preferences', () => {
  const errorStore = useErrorStore()

  // —————— 启动 & 窗口模式（仅持久化，运行时状态由 layout store 管理） ——————
  const launchMode = ref<Preferences['launchMode']>(DEFAULT_PREFERENCES.launchMode)
  const launchFolderPath = ref<string | undefined>(DEFAULT_PREFERENCES.launchFolderPath)
  const isStickyNoteMode = ref<boolean>(DEFAULT_PREFERENCES.isStickyNoteMode)
  const isImmersiveMode = ref<boolean>(DEFAULT_PREFERENCES.isImmersiveMode)

  // —————— 自动保存 & 编辑器 ——————
  const autoSave = ref<boolean>(DEFAULT_PREFERENCES.autoSave)
  const autoSaveInterval = ref<number>(DEFAULT_PREFERENCES.autoSaveInterval)
  const fontSize = ref<number>(DEFAULT_PREFERENCES.fontSize)
  const lineHeight = ref<number>(DEFAULT_PREFERENCES.lineHeight)
  const sourceFontSize = ref<number>(DEFAULT_PREFERENCES.sourceFontSize)
  const sourceLineHeight = ref<number>(DEFAULT_PREFERENCES.sourceLineHeight)
  const zoom = ref<number>(DEFAULT_PREFERENCES.zoom)
  const wordWrap = ref<boolean>(DEFAULT_PREFERENCES.wordWrap)
  const wordCountDisplayType = ref<Preferences['wordCountDisplayType']>(DEFAULT_PREFERENCES.wordCountDisplayType)

  // —————— 主题 & 外观 ——————
  const theme = ref<Preferences['theme']>(DEFAULT_PREFERENCES.theme)
  const showMenuBar = ref<boolean>(DEFAULT_PREFERENCES.showMenuBar)
  const hideScrollBars = ref<boolean>(DEFAULT_PREFERENCES.hideScrollBars)
  const customThemePath = ref<string>(DEFAULT_PREFERENCES.customThemePath)
  const customThemes = ref<CustomTheme[]>(DEFAULT_PREFERENCES.customThemes)

  // —————— 语言 & 开发 ——————
  const language = ref<Preferences['language']>(DEFAULT_PREFERENCES.language)
  const devToolsOnStartup = ref<boolean>(DEFAULT_PREFERENCES.devToolsOnStartup)
  const lineEnding = ref<Preferences['lineEnding']>(DEFAULT_PREFERENCES.lineEnding)

  // —————— 文件 & 窗口行为 ——————
  const openFileInNewWindow = ref<boolean>(DEFAULT_PREFERENCES.openFileInNewWindow)
  const openFolderInNewWindow = ref<boolean>(DEFAULT_PREFERENCES.openFolderInNewWindow)
  const imageInsertMode = ref<Preferences['imageInsertMode']>(DEFAULT_PREFERENCES.imageInsertMode)
  const imageStoragePath = ref<string>(DEFAULT_PREFERENCES.imageStoragePath)

  // —————— 最近文件 & 会话 ——————
  const recentFiles = ref<RecentFile[]>(DEFAULT_PREFERENCES.recentFiles)
  const maxRecentFiles = ref<number>(DEFAULT_PREFERENCES.maxRecentFiles)
  const recentFolders = ref<RecentFolder[]>(DEFAULT_PREFERENCES.recentFolders)
  const maxRecentFolders = ref<number>(DEFAULT_PREFERENCES.maxRecentFolders)
  const lastSession = ref<Preferences['lastSession']>(DEFAULT_PREFERENCES.lastSession)

  // —————— Ref 映射表：消除 applyPatch 的 30+ case ——————
  const refMap: Record<keyof Preferences, Ref> = {
    launchMode, launchFolderPath, autoSave, autoSaveInterval,
    theme, showMenuBar, hideScrollBars, isStickyNoteMode, isImmersiveMode,
    fontSize, lineHeight, sourceFontSize, sourceLineHeight,
    zoom, wordWrap, wordCountDisplayType,
    imageInsertMode, imageStoragePath,
    language, devToolsOnStartup, lineEnding,
    openFileInNewWindow, openFolderInNewWindow,
    recentFiles, maxRecentFiles, recentFolders, maxRecentFolders,
    customThemePath, customThemes, lastSession,
  }

  // —————————————— 副作用 ——————————————
  watch(language, (lang) => {
    setI18nLanguage(lang)
  }, { immediate: true })

  const { applyTheme, toggleLightDark } = useThemeService()
  watch(() => theme.value, () => {
    applyTheme()
  }, { immediate: true })

  watch(zoom, async (newZoom) => {
    if (window.electronAPI) {
      await window.electronAPI.setZoom(newZoom)
    }
  })

  // RecentFilesService 懒实例化（避免 store 内循环）
  let recentFilesService: ReturnType<typeof useRecentFilesService> | null = null
  function rfs() {
    if (!recentFilesService) recentFilesService = useRecentFilesService()
    return recentFilesService
  }

  // —————————————— 快照 & 写入 ——————————————
  function getAllPreferences(): Preferences {
    const result = {} as Preferences
    for (const [key, r] of Object.entries(refMap)) {
      (result as any)[key] = r.value
    }
    return result
  }

  function applyPatch(patch: Partial<Preferences>): void {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue
      const r = refMap[key as keyof Preferences]
      if (r) r.value = value as any
    }
  }

  function setOne<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    const plainValue = (value !== null && typeof value === 'object')
      ? (JSON.parse(JSON.stringify(value)) as Preferences[K])
      : value

    if (window.electronAPI?.preferencesSetOne) {
      window.electronAPI.preferencesSetOne(key as string, plainValue as unknown).catch((err) => {
        errorStore.createError(
          ErrorCode.FILE_WRITE_ERROR,
          `保存偏好 ${key} 失败：${err instanceof Error ? err.message : String(err)}`,
          ErrorSeverity.ERROR,
          { context: 'preferences.setOne' }
        )
      })
    } else {
      applyPatch({ [key]: plainValue } as Partial<Preferences>)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(getAllPreferences()))
      } catch { /* 配额满等故障静默 */ }
    }
  }

  function setMany(patch: Partial<Preferences>): void {
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) setOne(k as keyof Preferences, v as Preferences[keyof Preferences])
    }
  }

  function resetToDefaults(): void {
    setMany(DEFAULT_PREFERENCES)
  }

  // —————————————— 复合操作 ——————————————
  function saveSession(data: Preferences['lastSession']): void {
    setOne('lastSession', data)
  }

  function getLastSession(): Preferences['lastSession'] {
    return lastSession.value
  }

  function clearSession(): void {
    setOne('lastSession', undefined)
  }

  function toggleWordCountDisplayType(): void {
    setOne('wordCountDisplayType', wordCountDisplayType.value === 'raw' ? 'rendered' : 'raw')
  }

  function zoomIn(): void {
    setOne('zoom', Math.min(200, zoom.value + 10))
  }

  function zoomOut(): void {
    setOne('zoom', Math.max(50, zoom.value - 10))
  }

  function resetZoom(): void {
    setOne('zoom', DEFAULT_PREFERENCES.zoom)
  }

  // —————————————— 启动加载 ——————————————
  async function loadPreferences(): Promise<void> {
    let preferences: Partial<Preferences> | null = null
    let needMigrate = false

    try {
      if (window.electronAPI) {
        try {
          const resp = await window.electronAPI.preferencesGetAll()
          if (resp.success && resp.data) {
            preferences = resp.data as Partial<Preferences>
          }
        } catch { /* IPC 失败回退 localStorage */ }
      }

      if (!preferences) {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          preferences = JSON.parse(saved) as Partial<Preferences>
          if (window.electronAPI) needMigrate = true
        }
      }

      if (preferences) {
        applyPatch(preferences)
        if (needMigrate && window.electronAPI) {
          const plain = JSON.parse(JSON.stringify(getAllPreferences())) as Record<string, unknown>
          window.electronAPI.preferencesSetAll(plain).catch(() => { /* 静默 */ })
        }
      }
    } catch { /* 加载失败用默认值 */ }

    if (window.electronAPI?.onPreferencesChanged) {
      window.electronAPI.onPreferencesChanged((patch) => {
        applyPatch(patch as Partial<Preferences>)
      })
    }

    // 监听解耦后的事件：fileExplorer/tabs 不再直接调用 addRecent*
    eventBus.on(AppEvents.FILE_OPENED, ({ filePath, tabId }: { filePath: string; tabId?: string }) => {
      const title = tabId ? (tabId.split('/').pop() || filePath) : filePath
      rfs().addRecentFile(filePath, title)
    })
    eventBus.on(AppEvents.FOLDER_OPENED, ({ folderPath }: { folderPath: string }) => {
      const name = folderPath.split(/[/\\]/).pop() || folderPath
      rfs().addRecentFolder(folderPath, name)
    })
  }

  async function loadCustomThemes(): Promise<void> {
    if (!customThemePath.value || !window.electronAPI) return
    try {
      const response = await window.electronAPI.readDirectory(customThemePath.value)
      if (response && response.success && response.data) {
        const themes: CustomTheme[] = []
        for (const entry of response.data) {
          if (entry.isFile && entry.name.endsWith('.json')) {
            const fileResponse = await window.electronAPI.readFile(entry.path)
            if (fileResponse && fileResponse.success && fileResponse.data) {
              try {
                const themeData = JSON.parse(fileResponse.data)
                if (themeData.name && themeData.colors) {
                  themes.push({ id: entry.path, name: themeData.name, path: entry.path, colors: themeData.colors })
                }
              } catch { /* skip invalid */ }
            }
          }
        }
        setOne('customThemes', themes)
      }
    } catch { /* silent */ }
  }

  function applyCustomTheme(themeId: string): void {
    const customTheme = customThemes.value.find((t) => t.id === themeId)
    if (!customTheme) return
    Object.entries(customTheme.colors).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value as string)
    })
    setOne('theme', `custom-${themeId}` as 'light' | 'dark' | 'system')
  }

  function resetToBuiltInTheme(): void {
    setOne('theme', DEFAULT_PREFERENCES.theme)
  }

  return {
    // —— 状态（外部只读；写入走 setOne）
    launchMode, launchFolderPath, autoSave, autoSaveInterval,
    theme, showMenuBar, hideScrollBars,
    fontSize, lineHeight, sourceFontSize, sourceLineHeight,
    zoom, wordWrap, wordCountDisplayType,
    imageInsertMode, imageStoragePath,
    language, devToolsOnStartup, lineEnding,
    openFileInNewWindow, openFolderInNewWindow,
    recentFiles, maxRecentFiles, recentFolders, maxRecentFolders,
    customThemePath, customThemes, lastSession,

    // —— 写入入口
    setOne, setMany, resetToDefaults,

    // —— 复合操作
    applyTheme, toggleLightDark,
    addRecentFile: (filePath: string, title: string) => rfs().addRecentFile(filePath, title),
    removeRecentFile: (filePath: string) => rfs().removeRecentFile(filePath),
    pinRecentFile: (filePath: string, pinned: boolean) => rfs().pinRecentFile(filePath, pinned),
    clearRecentFiles: () => rfs().clearRecentFiles(),
    addRecentFolder: (folderPath: string, name: string) => rfs().addRecentFolder(folderPath, name),
    removeRecentFolder: (folderPath: string) => rfs().removeRecentFolder(folderPath),
    pinRecentFolder: (folderPath: string, pinned: boolean) => rfs().pinRecentFolder(folderPath, pinned),
    clearRecentFolders: () => rfs().clearRecentFolders(),
    loadCustomThemes, applyCustomTheme, resetToBuiltInTheme,
    toggleWordCountDisplayType, zoomIn, zoomOut, resetZoom,
    saveSession, getLastSession, clearSession, loadPreferences,

    /** @deprecated 用 setOne(key, value) 替代 */
    setPreference: setOne,
    /** @deprecated 用 setMany(patch) 替代 */
    updatePreferences: setMany,
    /** @deprecated 所有写入走 IPC，无单独 save 入口 */
    savePreferences: () => { /* no-op */ },
  }
})
