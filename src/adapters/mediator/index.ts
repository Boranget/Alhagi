import { AppMediator } from './AppMediator'
import { TabCommandHandler } from './handlers/TabCommandHandler'
import { PreferenceCommandHandler } from './handlers/PreferenceCommandHandler'
import { LayoutCommandHandler } from './handlers/LayoutCommandHandler'
import { SearchCommandHandler } from './handlers/SearchCommandHandler'
import { ViewModeCommandHandler } from './handlers/ViewModeCommandHandler'
import { FileExplorerCommandHandler } from './handlers/FileExplorerCommandHandler'
import { useTabQueries } from './handlers/TabQueryAdapter'
import { usePreferenceQueries } from './handlers/PreferenceQueryAdapter'
import { useSearchQueries } from './handlers/SearchQueryAdapter'
import {
  TabCommands, TabQueries,
  PreferenceCommands, PreferenceQueries,
  LayoutCommands, LayoutQueries,
  SearchCommands, SearchQueries,
  ViewModeCommands, ViewModeQueries,
  FileExplorerCommands, FileExplorerQueries,
} from './commands'
import { useLayoutStore } from '@/stores/layout'
import { useViewModeStore } from '@/stores/viewMode'
import { useFileExplorerStore } from '@/stores/fileExplorer'

let _mediator: AppMediator | null = null

export function getMediator(): AppMediator {
  if (!_mediator) {
    _mediator = new AppMediator()
    registerCommandHandlers(_mediator)
    registerQueryHandlers(_mediator)
  }
  return _mediator
}

function registerCommandHandlers(mediator: AppMediator): void {
  const tab = new TabCommandHandler()
  const pref = new PreferenceCommandHandler()
  const layout = new LayoutCommandHandler()
  const search = new SearchCommandHandler()
  const viewMode = new ViewModeCommandHandler()
  const file = new FileExplorerCommandHandler()

  // Tab commands
  mediator.registerCommand(TabCommands.CREATE, { execute: (p) => tab.execute({ type: TabCommands.CREATE, ...p as object }) })
  mediator.registerCommand(TabCommands.CLOSE, { execute: (p) => tab.execute({ type: TabCommands.CLOSE, ...p as object }) })
  mediator.registerCommand(TabCommands.SWITCH, { execute: (p) => tab.execute({ type: TabCommands.SWITCH, ...p as object }) })
  mediator.registerCommand(TabCommands.UPDATE, { execute: (p) => tab.execute({ type: TabCommands.UPDATE, ...p as object }) })
  mediator.registerCommand(TabCommands.MARK_DIRTY, { execute: (p) => tab.execute({ type: TabCommands.MARK_DIRTY, ...p as object }) })
  mediator.registerCommand(TabCommands.MARK_CLEAN, { execute: (p) => tab.execute({ type: TabCommands.MARK_CLEAN, ...p as object }) })
  mediator.registerCommand(TabCommands.SET_VIEW_MODE, { execute: (p) => tab.execute({ type: TabCommands.SET_VIEW_MODE, ...p as object }) })
  mediator.registerCommand(TabCommands.REMOVE, { execute: (p) => tab.execute({ type: TabCommands.REMOVE, ...p as object }) })

  // Preference commands
  mediator.registerCommand(PreferenceCommands.SET, { execute: (p) => pref.execute({ type: PreferenceCommands.SET, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.SET_MANY, { execute: (p) => pref.execute({ type: PreferenceCommands.SET_MANY, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.ZOOM_IN, { execute: (p) => pref.execute({ type: PreferenceCommands.ZOOM_IN, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.ZOOM_OUT, { execute: (p) => pref.execute({ type: PreferenceCommands.ZOOM_OUT, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.RESET_ZOOM, { execute: (p) => pref.execute({ type: PreferenceCommands.RESET_ZOOM, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.TOGGLE_LIGHT_DARK, { execute: (p) => pref.execute({ type: PreferenceCommands.TOGGLE_LIGHT_DARK, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.TOGGLE_WORD_COUNT_DISPLAY, { execute: (p) => pref.execute({ type: PreferenceCommands.TOGGLE_WORD_COUNT_DISPLAY, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.RESET_TO_DEFAULTS, { execute: (p) => pref.execute({ type: PreferenceCommands.RESET_TO_DEFAULTS, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.ADD_RECENT_FILE, { execute: (p) => pref.execute({ type: PreferenceCommands.ADD_RECENT_FILE, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.REMOVE_RECENT_FILE, { execute: (p) => pref.execute({ type: PreferenceCommands.REMOVE_RECENT_FILE, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.PIN_RECENT_FILE, { execute: (p) => pref.execute({ type: PreferenceCommands.PIN_RECENT_FILE, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.CLEAR_RECENT_FILES, { execute: (p) => pref.execute({ type: PreferenceCommands.CLEAR_RECENT_FILES, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.ADD_RECENT_FOLDER, { execute: (p) => pref.execute({ type: PreferenceCommands.ADD_RECENT_FOLDER, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.REMOVE_RECENT_FOLDER, { execute: (p) => pref.execute({ type: PreferenceCommands.REMOVE_RECENT_FOLDER, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.PIN_RECENT_FOLDER, { execute: (p) => pref.execute({ type: PreferenceCommands.PIN_RECENT_FOLDER, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.CLEAR_RECENT_FOLDERS, { execute: (p) => pref.execute({ type: PreferenceCommands.CLEAR_RECENT_FOLDERS, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.SAVE_SESSION, { execute: (p) => pref.execute({ type: PreferenceCommands.SAVE_SESSION, ...p as object }) })
  mediator.registerCommand(PreferenceCommands.CLEAR_SESSION, { execute: (p) => pref.execute({ type: PreferenceCommands.CLEAR_SESSION, ...p as object }) })

  // Layout commands
  mediator.registerCommand(LayoutCommands.SET_SIDEBAR, { execute: (p) => layout.execute({ type: LayoutCommands.SET_SIDEBAR, ...p as object }) })
  mediator.registerCommand(LayoutCommands.SET_TAB_BAR, { execute: (p) => layout.execute({ type: LayoutCommands.SET_TAB_BAR, ...p as object }) })
  mediator.registerCommand(LayoutCommands.SET_STATUS_BAR, { execute: (p) => layout.execute({ type: LayoutCommands.SET_STATUS_BAR, ...p as object }) })
  mediator.registerCommand(LayoutCommands.TOGGLE_SIDEBAR, { execute: (p) => layout.execute({ type: LayoutCommands.TOGGLE_SIDEBAR, ...p as object }) })
  mediator.registerCommand(LayoutCommands.TOGGLE_TAB_BAR, { execute: (p) => layout.execute({ type: LayoutCommands.TOGGLE_TAB_BAR, ...p as object }) })
  mediator.registerCommand(LayoutCommands.TOGGLE_STATUS_BAR, { execute: (p) => layout.execute({ type: LayoutCommands.TOGGLE_STATUS_BAR, ...p as object }) })
  mediator.registerCommand(LayoutCommands.APPLY_WINDOW_MODE, { execute: (p) => layout.execute({ type: LayoutCommands.APPLY_WINDOW_MODE, ...p as object }) })
  mediator.registerCommand(LayoutCommands.RESTORE_DEFAULTS, { execute: (p) => layout.execute({ type: LayoutCommands.RESTORE_DEFAULTS, ...p as object }) })
  mediator.registerCommand(LayoutCommands.SET_STICKY_NOTE_MODE, { execute: (p) => layout.execute({ type: LayoutCommands.SET_STICKY_NOTE_MODE, ...p as object }) })
  mediator.registerCommand(LayoutCommands.SET_IMMERSIVE_MODE, { execute: (p) => layout.execute({ type: LayoutCommands.SET_IMMERSIVE_MODE, ...p as object }) })

  // Search commands
  mediator.registerCommand(SearchCommands.EXECUTE, { execute: (p) => search.execute({ type: SearchCommands.EXECUTE, ...p as object }) })
  mediator.registerCommand(SearchCommands.FIND_NEXT, { execute: (p) => search.execute({ type: SearchCommands.FIND_NEXT, ...p as object }) })
  mediator.registerCommand(SearchCommands.FIND_PREV, { execute: (p) => search.execute({ type: SearchCommands.FIND_PREV, ...p as object }) })
  mediator.registerCommand(SearchCommands.REPLACE_NEXT, { execute: (p) => search.execute({ type: SearchCommands.REPLACE_NEXT, ...p as object }) })
  mediator.registerCommand(SearchCommands.REPLACE_ALL, { execute: (p) => search.execute({ type: SearchCommands.REPLACE_ALL, ...p as object }) })
  mediator.registerCommand(SearchCommands.CLEAR, { execute: (p) => search.execute({ type: SearchCommands.CLEAR, ...p as object }) })

  // ViewMode commands
  mediator.registerCommand(ViewModeCommands.SET_TYPEWRITER_MODE, { execute: (p) => viewMode.execute({ type: ViewModeCommands.SET_TYPEWRITER_MODE, ...p as object }) })
  mediator.registerCommand(ViewModeCommands.SET_FOCUS_MODE, { execute: (p) => viewMode.execute({ type: ViewModeCommands.SET_FOCUS_MODE, ...p as object }) })
  mediator.registerCommand(ViewModeCommands.TOGGLE_TYPEWRITER_MODE, { execute: (p) => viewMode.execute({ type: ViewModeCommands.TOGGLE_TYPEWRITER_MODE, ...p as object }) })
  mediator.registerCommand(ViewModeCommands.TOGGLE_FOCUS_MODE, { execute: (p) => viewMode.execute({ type: ViewModeCommands.TOGGLE_FOCUS_MODE, ...p as object }) })

  // FileExplorer commands
  mediator.registerCommand(FileExplorerCommands.OPEN_FOLDER, { execute: (p) => file.execute({ type: FileExplorerCommands.OPEN_FOLDER, ...p as object }) })
  mediator.registerCommand(FileExplorerCommands.OPEN_FOLDER_BY_PATH, { execute: (p) => file.execute({ type: FileExplorerCommands.OPEN_FOLDER_BY_PATH, ...p as object }) })
  mediator.registerCommand(FileExplorerCommands.REFRESH_TREE, { execute: (p) => file.execute({ type: FileExplorerCommands.REFRESH_TREE, ...p as object }) })
  mediator.registerCommand(FileExplorerCommands.TOGGLE_FOLDER, { execute: (p) => file.execute({ type: FileExplorerCommands.TOGGLE_FOLDER, ...p as object }) })
  mediator.registerCommand(FileExplorerCommands.CREATE_FILE, { execute: (p) => file.execute({ type: FileExplorerCommands.CREATE_FILE, ...p as object }) })
  mediator.registerCommand(FileExplorerCommands.CREATE_DIRECTORY, { execute: (p) => file.execute({ type: FileExplorerCommands.CREATE_DIRECTORY, ...p as object }) })
  mediator.registerCommand(FileExplorerCommands.DELETE_FILE, { execute: (p) => file.execute({ type: FileExplorerCommands.DELETE_FILE, ...p as object }) })
  mediator.registerCommand(FileExplorerCommands.RENAME_FILE, { execute: (p) => file.execute({ type: FileExplorerCommands.RENAME_FILE, ...p as object }) })
}

function registerQueryHandlers(mediator: AppMediator): void {
  const tabQueries = useTabQueries()
  const prefQueries = usePreferenceQueries()
  const searchQueries = useSearchQueries()

  // Tab queries
  mediator.registerQuery(TabQueries.GET_ALL, { execute: () => tabQueries.getAll() })
  mediator.registerQuery(TabQueries.GET_BY_ID, { execute: (p) => tabQueries.getById((p as { id: string }).id) })
  mediator.registerQuery(TabQueries.GET_ACTIVE, { execute: () => tabQueries.getActive() })
  mediator.registerQuery(TabQueries.GET_DIRTY, { execute: () => tabQueries.getDirty() })
  mediator.registerQuery(TabQueries.FIND_BY_PATH, { execute: (p) => tabQueries.findByPath((p as { path: string }).path) })
  mediator.registerQuery(TabQueries.GET_COUNT, { execute: () => tabQueries.getCount() })
  mediator.registerQuery(TabQueries.GET_ORDER, { execute: () => tabQueries.getOrder() })
  mediator.registerQuery(TabQueries.HAS_OPEN_FILES, { execute: () => tabQueries.hasOpenFiles() })

  // Preference queries
  mediator.registerQuery(PreferenceQueries.GET, { execute: (p) => prefQueries.get((p as { key: string }).key as keyof import('@core/entities/Preferences').PreferencesProps) })
  mediator.registerQuery(PreferenceQueries.GET_ALL, { execute: () => prefQueries.getAll() })

  // Search queries
  mediator.registerQuery(SearchQueries.GET_QUERY, { execute: () => searchQueries.getQuery() })
  mediator.registerQuery(SearchQueries.GET_MATCHES, { execute: () => searchQueries.getMatches() })
  mediator.registerQuery(SearchQueries.GET_CURRENT_INDEX, { execute: () => searchQueries.getCurrentIndex() })
  mediator.registerQuery(SearchQueries.GET_TOTAL, { execute: () => searchQueries.getTotal() })
  mediator.registerQuery(SearchQueries.GET_CURRENT_MATCH, { execute: () => searchQueries.getCurrentMatch() })

  // Layout queries (direct store access — read-only, reactive)
  const layoutStore = useLayoutStore()
  mediator.registerQuery(LayoutQueries.GET_SIDEBAR, { execute: () => layoutStore.showSidebar })
  mediator.registerQuery(LayoutQueries.GET_TAB_BAR, { execute: () => layoutStore.showTabBar })
  mediator.registerQuery(LayoutQueries.GET_STATUS_BAR, { execute: () => layoutStore.showStatusBar })
  mediator.registerQuery(LayoutQueries.GET_STICKY_NOTE_MODE, { execute: () => layoutStore.isStickyNoteMode })
  mediator.registerQuery(LayoutQueries.GET_IMMERSIVE_MODE, { execute: () => layoutStore.isImmersiveMode })
  mediator.registerQuery(LayoutQueries.GET_ALL, { execute: () => ({
    showSidebar: layoutStore.showSidebar,
    showTabBar: layoutStore.showTabBar,
    showStatusBar: layoutStore.showStatusBar,
    isStickyNoteMode: layoutStore.isStickyNoteMode,
    isImmersiveMode: layoutStore.isImmersiveMode,
  }) })

  // ViewMode queries (direct store access — read-only, reactive)
  const viewModeStore = useViewModeStore()
  mediator.registerQuery(ViewModeQueries.GET_TYPEWRITER_MODE, { execute: () => viewModeStore.typewriterMode })
  mediator.registerQuery(ViewModeQueries.GET_FOCUS_MODE, { execute: () => viewModeStore.focusMode })

  // FileExplorer queries (direct store access — read-only, reactive)
  const fileStore = useFileExplorerStore()
  mediator.registerQuery(FileExplorerQueries.GET_CURRENT_FOLDER, { execute: () => fileStore.currentFolder })
  mediator.registerQuery(FileExplorerQueries.GET_FILE_TREE, { execute: () => fileStore.fileTree })
  mediator.registerQuery(FileExplorerQueries.GET_IS_LOADING, { execute: () => fileStore.isLoading })
  mediator.registerQuery(FileExplorerQueries.GET_ERROR, { execute: () => fileStore.error })
}
