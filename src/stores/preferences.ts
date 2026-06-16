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
import { ref, watch } from 'vue'
import type { RecentFile, RecentFolder } from '@/types'
import { errorManager, ErrorCode, ErrorSeverity } from '@/services/errorHandler'
import { UI, EDITOR, AUTO_SAVE, I18N, IMAGE, LAUNCH } from '@/constants'
import { useThemeService } from '@/services/theme/ThemeService'
import { useRecentFilesService } from '@/services/recentFiles/RecentFilesService'
import { setLanguage as setI18nLanguage } from '@/services/i18n'
import { useLayoutStore } from '@/stores/layout'

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
  // —————————————— 状态 refs ——————————————
  const launchMode = ref<Preferences['launchMode']>(DEFAULT_PREFERENCES.launchMode)
  const launchFolderPath = ref<string | undefined>(DEFAULT_PREFERENCES.launchFolderPath)
  const autoSave = ref<boolean>(DEFAULT_PREFERENCES.autoSave)
  const autoSaveInterval = ref<number>(DEFAULT_PREFERENCES.autoSaveInterval)
  const theme = ref<Preferences['theme']>(DEFAULT_PREFERENCES.theme)
  const showMenuBar = ref<boolean>(DEFAULT_PREFERENCES.showMenuBar)
  const hideScrollBars = ref<boolean>(DEFAULT_PREFERENCES.hideScrollBars)
  const isStickyNoteMode = ref<boolean>(DEFAULT_PREFERENCES.isStickyNoteMode)
  const isImmersiveMode = ref<boolean>(DEFAULT_PREFERENCES.isImmersiveMode)
  const fontSize = ref<number>(DEFAULT_PREFERENCES.fontSize)
  const lineHeight = ref<number>(DEFAULT_PREFERENCES.lineHeight)
  const sourceFontSize = ref<number>(DEFAULT_PREFERENCES.sourceFontSize)
  const sourceLineHeight = ref<number>(DEFAULT_PREFERENCES.sourceLineHeight)
  const zoom = ref<number>(DEFAULT_PREFERENCES.zoom)
  const wordWrap = ref<boolean>(DEFAULT_PREFERENCES.wordWrap)
  const imageInsertMode = ref<Preferences['imageInsertMode']>(DEFAULT_PREFERENCES.imageInsertMode)
  const imageStoragePath = ref<string>(DEFAULT_PREFERENCES.imageStoragePath)
  const language = ref<Preferences['language']>(DEFAULT_PREFERENCES.language)
  const devToolsOnStartup = ref<boolean>(DEFAULT_PREFERENCES.devToolsOnStartup)
  const openFileInNewWindow = ref<boolean>(DEFAULT_PREFERENCES.openFileInNewWindow)
  const openFolderInNewWindow = ref<boolean>(DEFAULT_PREFERENCES.openFolderInNewWindow)
  const lineEnding = ref<Preferences['lineEnding']>(DEFAULT_PREFERENCES.lineEnding)
  const recentFiles = ref<RecentFile[]>(DEFAULT_PREFERENCES.recentFiles)
  const maxRecentFiles = ref<number>(DEFAULT_PREFERENCES.maxRecentFiles)
  const recentFolders = ref<RecentFolder[]>(DEFAULT_PREFERENCES.recentFolders)
  const maxRecentFolders = ref<number>(DEFAULT_PREFERENCES.maxRecentFolders)
  const customThemePath = ref<string>(DEFAULT_PREFERENCES.customThemePath)
  const customThemes = ref<CustomTheme[]>(DEFAULT_PREFERENCES.customThemes)
  const wordCountDisplayType = ref<Preferences['wordCountDisplayType']>(DEFAULT_PREFERENCES.wordCountDisplayType)
  const lastSession = ref<Preferences['lastSession']>(DEFAULT_PREFERENCES.lastSession)

  // —————————————— 副作用挂在 watch 上 ——————————————
  // ref 一旦变化就触发，无论变化来源（applyPatch / 启动初始化）。

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

  // RecentFilesService 在 store setup 期间不实例化（避免 store 内部循环 useStore）。
  // 通过 lazy getter 在首次使用时才实例化 —— 此时 store 已经 ready。
  let recentFilesService: ReturnType<typeof useRecentFilesService> | null = null
  function rfs() {
    if (!recentFilesService) recentFilesService = useRecentFilesService()
    return recentFilesService
  }

  // —————————————— 辅助：从 store 读出全量快照（用于 SET_ALL 迁移） ——————————————
  function getAllPreferences(): Preferences {
    return {
      launchMode: launchMode.value,
      launchFolderPath: launchFolderPath.value,
      autoSave: autoSave.value,
      autoSaveInterval: autoSaveInterval.value,
      theme: theme.value,
      showMenuBar: showMenuBar.value,
      hideScrollBars: hideScrollBars.value,
      isStickyNoteMode: isStickyNoteMode.value,
      isImmersiveMode: isImmersiveMode.value,
      fontSize: fontSize.value,
      lineHeight: lineHeight.value,
      sourceFontSize: sourceFontSize.value,
      sourceLineHeight: sourceLineHeight.value,
      zoom: zoom.value,
      wordWrap: wordWrap.value,
      imageInsertMode: imageInsertMode.value,
      imageStoragePath: imageStoragePath.value,
      language: language.value,
      devToolsOnStartup: devToolsOnStartup.value,
      openFileInNewWindow: openFileInNewWindow.value,
      openFolderInNewWindow: openFolderInNewWindow.value,
      lineEnding: lineEnding.value,
      recentFiles: recentFiles.value,
      maxRecentFiles: maxRecentFiles.value,
      recentFolders: recentFolders.value,
      maxRecentFolders: maxRecentFolders.value,
      customThemePath: customThemePath.value,
      customThemes: customThemes.value,
      wordCountDisplayType: wordCountDisplayType.value,
      lastSession: lastSession.value
    }
  }

  // —————————————— 唯一的"写"入口：把 patch 应用到本地 ref ——————————————
  // 仅在 IPC 广播回调里被调用（包括启动时 GET_ALL 灌入）。UI 路径不允许直接调。
  function applyPatch(patch: Partial<Preferences>): void {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue
      switch (key as keyof Preferences) {
        case 'launchMode': launchMode.value = value as Preferences['launchMode']; break
        case 'launchFolderPath': launchFolderPath.value = value as string; break
        case 'autoSave': autoSave.value = value as boolean; break
        case 'autoSaveInterval': autoSaveInterval.value = value as number; break
        case 'theme': theme.value = value as Preferences['theme']; break
        case 'showMenuBar': showMenuBar.value = value as boolean; break
        case 'hideScrollBars': hideScrollBars.value = value as boolean; break
        case 'isStickyNoteMode': isStickyNoteMode.value = value as boolean; break
        case 'isImmersiveMode': isImmersiveMode.value = value as boolean; break
        case 'fontSize': fontSize.value = value as number; break
        case 'lineHeight': lineHeight.value = value as number; break
        case 'sourceFontSize': sourceFontSize.value = value as number; break
        case 'sourceLineHeight': sourceLineHeight.value = value as number; break
        case 'zoom': zoom.value = value as number; break
        case 'wordWrap': wordWrap.value = value as boolean; break
        case 'imageInsertMode': imageInsertMode.value = value as Preferences['imageInsertMode']; break
        case 'imageStoragePath': imageStoragePath.value = value as string; break
        case 'language': language.value = value as Preferences['language']; break
        case 'devToolsOnStartup': devToolsOnStartup.value = value as boolean; break
        case 'openFileInNewWindow': openFileInNewWindow.value = value as boolean; break
        case 'openFolderInNewWindow': openFolderInNewWindow.value = value as boolean; break
        case 'lineEnding': lineEnding.value = value as Preferences['lineEnding']; break
        case 'recentFiles': recentFiles.value = value as RecentFile[]; break
        case 'maxRecentFiles': maxRecentFiles.value = value as number; break
        case 'recentFolders': recentFolders.value = value as RecentFolder[]; break
        case 'maxRecentFolders': maxRecentFolders.value = value as number; break
        case 'customThemePath': customThemePath.value = value as string; break
        case 'customThemes': customThemes.value = value as CustomTheme[]; break
        case 'wordCountDisplayType': wordCountDisplayType.value = value as Preferences['wordCountDisplayType']; break
        case 'lastSession': lastSession.value = value as Preferences['lastSession']; break
      }
    }
  }

  // —————————————— Single-Writer 写入入口 ——————————————
  /**
   * UI 操作的唯一写入入口。
   *
   * 行为：发 IPC SET_ONE → 主进程写盘 → 主进程广播 patch 给所有窗口（含发起方）
   *      → 各窗口 onPreferencesChanged 收到 patch → applyPatch → ref 更新 → watcher 触发副作用。
   *
   * 故意不本地乐观更新：保证多窗口在同一帧看到同样的值，无任何竞态。
   * 多花一帧的代价（毫秒级）换来零一致性 bug。
   *
   * 浏览器/无 Electron 环境兜底：直接 applyPatch + localStorage 写入。
   */
  function setOne<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    // 关键：value 可能是 Vue reactive proxy 包的数组/对象（例如 recentFiles）。
    // ipcRenderer.invoke 用 structured-clone 序列化 Proxy 会抛
    // "An object could not be cloned"。复杂值（非原始类型）走 JSON 剥 proxy
    // 后再发 IPC；原始类型直接传，零额外开销。
    const plainValue = (value !== null && typeof value === 'object')
      ? (JSON.parse(JSON.stringify(value)) as Preferences[K])
      : value

    if (window.electronAPI?.preferencesSetOne) {
      window.electronAPI.preferencesSetOne(key as string, plainValue as unknown).catch((err) => {
        errorManager.createError(
          ErrorCode.FILE_WRITE_ERROR,
          `保存偏好 ${key} 失败：${err instanceof Error ? err.message : String(err)}`,
          ErrorSeverity.ERROR,
          { context: 'preferences.setOne' }
        )
      })
    } else {
      // 浏览器/无 IPC：本地直接写 + localStorage。这是退化路径。
      applyPatch({ [key]: plainValue } as Partial<Preferences>)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(getAllPreferences()))
      } catch {
        // 配额满等故障静默
      }
    }
  }

  /**
   * 批量写入（仅供"恢复默认"等少数场景）。
   * 内部循环 setOne —— Electron 环境下产生 N 次 IPC + N 次广播。这是可接受的
   * 因为这种入口极少调用，且每次 patch 都是"用户明确想批量重置"。
   * 不对外暴露给 UI 控件 onChange 这种高频路径。
   */
  function setMany(patch: Partial<Preferences>): void {
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) setOne(k as keyof Preferences, v as Preferences[keyof Preferences])
    }
  }

  function resetToDefaults(): void {
    setMany(DEFAULT_PREFERENCES)
  }

  // —————————————— 复合操作（多字段联动） ——————————————
  // 这些操作同时影响多个字段；每个字段独立走 setOne，主进程会逐次广播。

  function toggleStickyNoteMode(): void {
    const next = !isStickyNoteMode.value
    setOne('isStickyNoteMode', next)
    const layoutStore = useLayoutStore()
    if (next) {
      layoutStore.setAll(false, false, false)
      setOne('showMenuBar', false)
    } else {
      layoutStore.restoreDefaults()
      setOne('showMenuBar', DEFAULT_PREFERENCES.showMenuBar)
    }
  }

  function toggleImmersiveMode(): void {
    const next = !isImmersiveMode.value
    setOne('isImmersiveMode', next)
    const layoutStore = useLayoutStore()
    if (next) {
      layoutStore.setAll(false, false, false)
      setOne('showMenuBar', false)
    } else {
      layoutStore.restoreDefaults()
      setOne('showMenuBar', DEFAULT_PREFERENCES.showMenuBar)
    }
  }

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

  // —————————————— 启动时加载 + 订阅广播 ——————————————

  /**
   * 加载偏好并订阅广播。
   *
   * 加载顺序：主进程 electron-store > localStorage（旧用户迁移） > 默认值。
   * 把已存数据用 applyPatch 灌入本地 ref，watch 自动触发副作用。
   */
  async function loadPreferences(): Promise<void> {
    let preferences: Partial<Preferences> | null = null
    let needMigrate = false

    try {
      // 1. 主进程 electron-store
      if (window.electronAPI) {
        try {
          const resp = await window.electronAPI.preferencesGetAll()
          if (resp.success && resp.data) {
            preferences = resp.data as Partial<Preferences>
          }
        } catch {
          // IPC 失败回退 localStorage
        }
      }

      // 2. localStorage（旧用户迁移）
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
          // 一次性迁移：整体覆写主进程 store。SET_ALL 不广播给发起方，
          // 不会触发回写循环；之后的所有写入都走 setOne。
          // 必须 JSON 反序列化剥掉 reactive proxy（structured-clone 会卡）。
          const plain = JSON.parse(JSON.stringify(getAllPreferences())) as Record<string, unknown>
          window.electronAPI.preferencesSetAll(plain).catch(() => { /* 静默 */ })
        }
      }
    } catch {
      // 加载失败：用默认值，watch immediate 已经把默认值的副作用跑了
    }

    // 订阅 patch 广播 —— 渲染端唯一写入路径。
    if (window.electronAPI?.onPreferencesChanged) {
      window.electronAPI.onPreferencesChanged((patch) => {
        applyPatch(patch as Partial<Preferences>)
      })
    }
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
                  themes.push({
                    id: entry.path,
                    name: themeData.name,
                    path: entry.path,
                    colors: themeData.colors
                  })
                }
              } catch {
                // skip invalid theme
              }
            }
          }
        }
        setOne('customThemes', themes)
      }
    } catch {
      // silent
    }
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
    // —— 状态（外部只读使用；写入必走 setOne / 复合操作）
    launchMode,
    launchFolderPath,
    autoSave,
    autoSaveInterval,
    theme,
    showMenuBar,
    hideScrollBars,
    isStickyNoteMode,
    isImmersiveMode,
    fontSize,
    lineHeight,
    sourceFontSize,
    sourceLineHeight,
    zoom,
    wordWrap,
    imageInsertMode,
    imageStoragePath,
    language,
    devToolsOnStartup,
    openFileInNewWindow,
    openFolderInNewWindow,
    lineEnding,
    recentFiles,
    maxRecentFiles,
    recentFolders,
    maxRecentFolders,
    customThemePath,
    customThemes,
    wordCountDisplayType,
    lastSession,

    // —— Single-Writer 写入入口
    setOne,
    setMany,
    resetToDefaults,

    // —— 复合操作 / 命令系统使用
    applyTheme,
    toggleLightDark,
    addRecentFile: (filePath: string, title: string) => rfs().addRecentFile(filePath, title),
    removeRecentFile: (filePath: string) => rfs().removeRecentFile(filePath),
    pinRecentFile: (filePath: string, pinned: boolean) => rfs().pinRecentFile(filePath, pinned),
    clearRecentFiles: () => rfs().clearRecentFiles(),
    addRecentFolder: (folderPath: string, name: string) => rfs().addRecentFolder(folderPath, name),
    removeRecentFolder: (folderPath: string) => rfs().removeRecentFolder(folderPath),
    pinRecentFolder: (folderPath: string, pinned: boolean) => rfs().pinRecentFolder(folderPath, pinned),
    clearRecentFolders: () => rfs().clearRecentFolders(),
    loadCustomThemes,
    applyCustomTheme,
    resetToBuiltInTheme,
    toggleStickyNoteMode,
    toggleImmersiveMode,
    toggleWordCountDisplayType,
    zoomIn,
    zoomOut,
    resetZoom,
    saveSession,
    getLastSession,
    clearSession,
    loadPreferences,

    // —— 兼容旧调用（已废弃，仅保留导出避免破坏；实现走 setOne）
    /** @deprecated 用 setOne(key, value) 替代 */
    setPreference: setOne,
    /** @deprecated 用 setMany(patch) 替代 */
    updatePreferences: setMany,
    /** @deprecated 不再需要：所有写入走 IPC，无单独 save 入口 */
    savePreferences: () => { /* no-op */ },
  }
})
