# Alhagi Mediator + ISP Migration Plan

## Architecture Summary

- **Writes**: `mediator.send(command)` → CommandHandler → Store
- **Reads**: Per-component ISP interfaces (thin `storeToRefs`/`computed` wrappers)
- **Context facades**: ELIMINATED
- **Use Cases**: Only for cross-aggregate business logic (CreateTab, CloseTab, etc.)

---

## Phase 1: Register Command Handlers (No Component Changes)

### New Command Definitions

**File: `src/adapters/mediator/commands.ts`** (MODIFY)

Add to existing file:

```typescript
// ── Layout Commands ────────────────────────────────────
export const LayoutCommands = {
  TOGGLE_SIDEBAR: 'layout:toggleSidebar',
  SET_SIDEBAR: 'layout:setSidebar',
  TOGGLE_TAB_BAR: 'layout:toggleTabBar',
  TOGGLE_STATUS_BAR: 'layout:toggleStatusBar',
  APPLY_WINDOW_MODE: 'layout:applyWindowMode',
} as const

// ── ViewMode Commands ─────────────────────────────────
export const ViewModeCommands = {
  TOGGLE_TYPEWRITER: 'viewMode:toggleTypewriter',
  TOGGLE_FOCUS: 'viewMode:toggleFocus',
  SET_TYPEWRITER: 'viewMode:setTypewriter',
  SET_FOCUS: 'viewMode:setFocus',
} as const

// ── Preference Commands (extend existing) ─────────────
// Already has: SET, SET_MANY, ZOOM_IN, ZOOM_OUT, RESET_ZOOM, TOGGLE_LIGHT_DARK
// Add:
export const PreferenceCommandsExtended = {
  TOGGLE_WORD_COUNT: 'preference:toggleWordCount',
  SAVE_SESSION: 'preference:saveSession',
  CLEAR_SESSION: 'preference:clearSession',
} as const

// ── Search Commands ───────────────────────────────────
export const SearchCommands = {
  SEARCH: 'search:search',
  CLEAR: 'search:clear',
  FIND_NEXT: 'search:findNext',
  FIND_PREV: 'search:findPrev',
  REPLACE_NEXT: 'search:replaceNext',
  REPLACE_ALL: 'search:replaceAll',
} as const

// ── FileExplorer Commands ─────────────────────────────
export const FileExplorerCommands = {
  OPEN_FOLDER: 'fileExplorer:openFolder',
  OPEN_FOLDER_BY_PATH: 'fileExplorer:openFolderByPath',
  REFRESH_TREE: 'fileExplorer:refreshTree',
  TOGGLE_FOLDER: 'fileExplorer:toggleFolder',
  CREATE_FILE: 'fileExplorer:createFile',
  CREATE_DIRECTORY: 'fileExplorer:createDirectory',
  DELETE_FILE: 'fileExplorer:deleteFile',
  RENAME_FILE: 'fileExplorer:renameFile',
} as const

// ── Tab Commands (extend existing) ────────────────────
// Already has: CREATE, CLOSE, SWITCH, UPDATE, MARK_DIRTY, MARK_CLEAN, SET_VIEW_MODE
// These are sufficient. Tab domain writes go through Use Cases.
```

### New Command Handler Files

**File: `src/adapters/mediator/handlers/LayoutCommandHandler.ts`** (CREATE)

```typescript
import { useLayoutStore } from '@/stores/layout'

export function registerLayoutCommands(mediator: AppMediator): void {
  const store = useLayoutStore()

  mediator.registerCommand(LayoutCommands.TOGGLE_SIDEBAR, {
    execute: () => { store.toggleSidebar() }
  })
  mediator.registerCommand(LayoutCommands.SET_SIDEBAR, {
    execute: (payload?: unknown) => { store.setSidebar((payload as { value: boolean }).value) }
  })
  mediator.registerCommand(LayoutCommands.TOGGLE_TAB_BAR, {
    execute: () => { store.toggleTabBar() }
  })
  mediator.registerCommand(LayoutCommands.TOGGLE_STATUS_BAR, {
    execute: () => { store.toggleStatusBar() }
  })
  mediator.registerCommand(LayoutCommands.APPLY_WINDOW_MODE, {
    execute: (payload?: unknown) => {
      store.applyWindowMode((payload as { mode: 'normal' | 'sticky' | 'immersive' }).mode)
    }
  })
}
```

**File: `src/adapters/mediator/handlers/ViewModeCommandHandler.ts`** (CREATE)

```typescript
import { useViewModeStore } from '@/stores/viewMode'

export function registerViewModeCommands(mediator: AppMediator): void {
  const store = useViewModeStore()

  mediator.registerCommand(ViewModeCommands.TOGGLE_TYPEWRITER, {
    execute: () => { store.setTypewriterMode(!store.typewriterMode) }
  })
  mediator.registerCommand(ViewModeCommands.TOGGLE_FOCUS, {
    execute: () => { store.setFocusMode(!store.focusMode) }
  })
  mediator.registerCommand(ViewModeCommands.SET_TYPEWRITER, {
    execute: (payload?: unknown) => { store.setTypewriterMode((payload as { value: boolean }).value) }
  })
  mediator.registerCommand(ViewModeCommands.SET_FOCUS, {
    execute: (payload?: unknown) => { store.setFocusMode((payload as { value: boolean }).value) }
  })
}
```

**File: `src/adapters/mediator/handlers/PreferenceCommandHandler.ts`** (CREATE)

```typescript
import { usePreferencesStore } from '@/stores/preferences'

export function registerPreferenceCommands(mediator: AppMediator): void {
  const store = usePreferencesStore()

  mediator.registerCommand(PreferenceCommands.SET, {
    execute: (payload?: unknown) => {
      const { key, value } = payload as { key: string; value: unknown }
      store.setOne(key as keyof Preferences, value)
    }
  })
  mediator.registerCommand(PreferenceCommands.ZOOM_IN, {
    execute: () => { store.zoomIn() }
  })
  mediator.registerCommand(PreferenceCommands.ZOOM_OUT, {
    execute: () => { store.zoomOut() }
  })
  mediator.registerCommand(PreferenceCommands.RESET_ZOOM, {
    execute: () => { store.resetZoom() }
  })
  mediator.registerCommand(PreferenceCommands.TOGGLE_LIGHT_DARK, {
    execute: () => { store.toggleLightDark() }
  })
  mediator.registerCommand(PreferenceCommandsExtended.TOGGLE_WORD_COUNT, {
    execute: () => { store.toggleWordCountDisplayType() }
  })
}
```

**File: `src/adapters/mediator/handlers/SearchCommandHandler.ts`** (CREATE)

```typescript
import { useSearchStore } from '@/stores/search'

export function registerSearchCommands(mediator: AppMediator): void {
  const store = useSearchStore()

  mediator.registerCommand(SearchCommands.SEARCH, {
    execute: (payload?: unknown) => {
      const { config, options } = payload as { config: SearchConfig; options?: { select?: boolean } }
      return store.search(config, options)
    }
  })
  mediator.registerCommand(SearchCommands.CLEAR, {
    execute: () => { store.clear() }
  })
  mediator.registerCommand(SearchCommands.FIND_NEXT, {
    execute: () => { return store.findNext() }
  })
  mediator.registerCommand(SearchCommands.FIND_PREV, {
    execute: () => { return store.findPrev() }
  })
  mediator.registerCommand(SearchCommands.REPLACE_NEXT, {
    execute: (payload?: unknown) => {
      return store.replaceNext((payload as { replacement: string }).replacement)
    }
  })
  mediator.registerCommand(SearchCommands.REPLACE_ALL, {
    execute: (payload?: unknown) => {
      return store.replaceAll((payload as { replacement: string }).replacement)
    }
  })
}
```

**File: `src/adapters/mediator/handlers/FileExplorerCommandHandler.ts`** (CREATE)

```typescript
import { useFileExplorerStore } from '@/stores/fileExplorer'

export function registerFileExplorerCommands(mediator: AppMediator): void {
  const store = useFileExplorerStore()

  mediator.registerCommand(FileExplorerCommands.OPEN_FOLDER, {
    execute: () => { return store.openFolder() }
  })
  mediator.registerCommand(FileExplorerCommands.OPEN_FOLDER_BY_PATH, {
    execute: (payload?: unknown) => {
      return store.openFolderByPath((payload as { path: string }).path)
    }
  })
  mediator.registerCommand(FileExplorerCommands.REFRESH_TREE, {
    execute: () => { return store.refreshTree() }
  })
  mediator.registerCommand(FileExplorerCommands.TOGGLE_FOLDER, {
    execute: (payload?: unknown) => {
      return store.toggleFolder((payload as { node: FileTreeNodeType }).node)
    }
  })
  mediator.registerCommand(FileExplorerCommands.CREATE_FILE, {
    execute: (payload?: unknown) => {
      const { dirPath, fileName } = payload as { dirPath: string; fileName: string }
      return store.createFile(dirPath, fileName)
    }
  })
  mediator.registerCommand(FileExplorerCommands.CREATE_DIRECTORY, {
    execute: (payload?: unknown) => {
      const { dirPath, dirName } = payload as { dirPath: string; dirName: string }
      return store.createDirectory(dirPath, dirName)
    }
  })
  mediator.registerCommand(FileExplorerCommands.DELETE_FILE, {
    execute: (payload?: unknown) => {
      return store.deleteFile((payload as { filePath: string }).filePath)
    }
  })
  mediator.registerCommand(FileExplorerCommands.RENAME_FILE, {
    execute: (payload?: unknown) => {
      const { oldPath, newName } = payload as { oldPath: string; newName: string }
      return store.renameFile(oldPath, newName)
    }
  })
}
```

**File: `src/adapters/mediator/handlers/index.ts`** (MODIFY)

```typescript
import { registerLayoutCommands } from './LayoutCommandHandler'
import { registerViewModeCommands } from './ViewModeCommandHandler'
import { registerPreferenceCommands } from './PreferenceCommandHandler'
import { registerSearchCommands } from './SearchCommandHandler'
import { registerFileExplorerCommands } from './FileExplorerCommandHandler'

export function registerAllCommandHandlers(mediator: AppMediator): void {
  registerLayoutCommands(mediator)
  registerViewModeCommands(mediator)
  registerPreferenceCommands(mediator)
  registerSearchCommands(mediator)
  registerFileExplorerCommands(mediator)
  // Tab commands already handled by existing Use Cases
}
```

**File: `src/adapters/mediator/index.ts`** (MODIFY)

Add call to `registerAllCommandHandlers` in `getMediator()`.

---

## Phase 2: ISP Read Interfaces

### Per-Component Read Interfaces

Each component gets a thin read interface that exposes ONLY the store state it needs.

**File: `src/adapters/composables/reads/StatusBar_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTabsStore } from '@/stores/tabs'
import { useLayoutStore } from '@/stores/layout'
import { usePreferencesStore } from '@/stores/preferences'
import { useViewModeStore } from '@/stores/viewMode'

export function useStatusBarReads() {
  const tabsStore = useTabsStore()
  const layoutStore = useLayoutStore()
  const prefsStore = usePreferencesStore()
  const viewModeStore = useViewModeStore()

  return {
    // Tab reads
    activeTab: computed(() => tabsStore.activeTab),
    // Layout reads
    showSidebar: computed(() => layoutStore.showSidebar),
    // Prefs reads
    wordCountDisplayType: computed(() => prefsStore.wordCountDisplayType),
    zoom: computed(() => prefsStore.zoom),
    theme: computed(() => prefsStore.theme),
    // ViewMode reads
    typewriterMode: computed(() => viewModeStore.typewriterMode),
    focusMode: computed(() => viewModeStore.focusMode),
  }
}
```

**File: `src/adapters/composables/reads/TabBar_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'

export function useTabBarReads() {
  const store = useTabsStore()

  return {
    activeTabId: computed(() => store.activeTabId),
    tabOrder: computed(() => store.tabOrder),
    tabs: store.tabs, // Map is reactive
    getTab: (id: string) => store.getTab(id),
  }
}
```

**File: `src/adapters/composables/reads/EditorContainer_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useViewModeStore } from '@/stores/viewMode'

export function useEditorContainerReads() {
  const tabsStore = useTabsStore()
  const viewModeStore = useViewModeStore()

  return {
    activeTab: computed(() => tabsStore.activeTab),
    activeTabId: computed(() => tabsStore.activeTabId),
    typewriterMode: computed(() => viewModeStore.typewriterMode),
    focusMode: computed(() => viewModeStore.focusMode),
  }
}
```

**File: `src/adapters/composables/reads/FileExplorer_reads.ts`** (CREATE)

```typescript
import { storeToRefs } from 'pinia'
import { useFileExplorerStore } from '@/stores/fileExplorer'

export function useFileExplorerReads() {
  const store = useFileExplorerStore()
  const { currentFolder, fileTree, isLoading, error } = storeToRefs(store)

  return { currentFolder, fileTree, isLoading, error }
}
```

**File: `src/adapters/composables/reads/RecentFiles_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'

export function useRecentFilesReads() {
  const store = usePreferencesStore()

  return {
    recentFiles: computed(() => store.recentFiles),
    recentFolders: computed(() => store.recentFolders),
  }
}
```

**File: `src/adapters/composables/reads/Welcome_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'

export function useWelcomeReads() {
  const store = usePreferencesStore()

  return {
    recentFiles: computed(() => store.recentFiles),
    recentFolders: computed(() => store.recentFolders),
    lastSession: computed(() => store.lastSession),
  }
}
```

**File: `src/adapters/composables/reads/App_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useLayoutStore } from '@/stores/layout'

export function useAppReads() {
  const tabsStore = useTabsStore()
  const layoutStore = useLayoutStore()

  return {
    tabCount: computed(() => tabsStore.tabCount),
    showSidebar: computed(() => layoutStore.showSidebar),
    showTabBar: computed(() => layoutStore.showTabBar),
    showStatusBar: computed(() => layoutStore.showStatusBar),
  }
}
```

**File: `src/adapters/composables/reads/GlobalSearch_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSearchStore } from '@/stores/search'

export function useGlobalSearchReads() {
  const store = useSearchStore()
  const { currentQuery, currentIndex, totalMatches } = storeToRefs(store)

  return { currentQuery, currentIndex, totalMatches }
}
```

**File: `src/adapters/composables/reads/PlainTextEditor_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'

export function usePlainTextEditorReads() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()

  return {
    activeTab: computed(() => tabsStore.activeTab),
    fontSize: computed(() => prefsStore.fontSize),
    lineHeight: computed(() => prefsStore.lineHeight),
    wordWrap: computed(() => prefsStore.wordWrap),
  }
}
```

**File: `src/adapters/composables/reads/CodeMirrorEditor_reads.ts`** (CREATE)

```typescript
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useLayoutStore } from '@/stores/layout'

export function useCodeMirrorEditorReads() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const layoutStore = useLayoutStore()

  return {
    activeTab: computed(() => tabsStore.activeTab),
    fontSize: computed(() => prefsStore.fontSize),
    lineHeight: computed(() => prefsStore.lineHeight),
    sourceFontSize: computed(() => prefsStore.sourceFontSize),
    sourceLineHeight: computed(() => prefsStore.sourceLineHeight),
    wordWrap: computed(() => prefsStore.wordWrap),
    showStatusBar: computed(() => layoutStore.showStatusBar),
  }
}
```

**File: `src/adapters/composables/reads/index.ts`** (CREATE)

```typescript
export { useStatusBarReads } from './StatusBar_reads'
export { useTabBarReads } from './TabBar_reads'
export { useEditorContainerReads } from './EditorContainer_reads'
export { useFileExplorerReads } from './FileExplorer_reads'
export { useRecentFilesReads } from './RecentFiles_reads'
export { useWelcomeReads } from './Welcome_reads'
export { useAppReads } from './App_reads'
export { useGlobalSearchReads } from './GlobalSearch_reads'
export { usePlainTextEditorReads } from './PlainTextEditor_reads'
export { useCodeMirrorEditorReads } from './CodeMirrorEditor_reads'
```

---

## Phase 3: Component Migration Steps

### Migration Order (simplest → most complex)

#### 1. StatusBar (simplest — fewest store dependencies)

| Current Facade | Replace With |
|---|---|
| `useTabContext()` | `useStatusBarReads()` + `mediator.send()` for writes |
| `useLayoutContext()` | `useStatusBarReads()` for reads + `mediator.send(LayoutCommands.TOGGLE_SIDEBAR)` |
| `usePreferencesContext()` | `useStatusBarReads()` for reads + `mediator.send(PreferenceCommands.*)` |
| `useViewModeContext()` | `useStatusBarReads()` for reads + commands already exist (`view.focusMode`, `view.typewriterMode`) |

**StatusBar.vue changes:**
- Remove: `useTabContext`, `useLayoutContext`, `usePreferencesContext`, `useViewModeContext`
- Add: `useStatusBarReads()`, `useMediator()` (or import `getMediator`)
- Replace `layout.toggleSidebar()` → `mediator.send({ type: LayoutCommands.TOGGLE_SIDEBAR })`
- Replace `toggleWordCountDisplayType()` → `mediator.send({ type: PreferenceCommands.TOGGLE_WORD_COUNT })`
- Replace `toggleLightDark()` → `mediator.send({ type: PreferenceCommands.TOGGLE_LIGHT_DARK })`
- Replace `zoomIn/zoomOut/resetZoom` → `mediator.send({ type: PreferenceCommands.ZOOM_IN/OUT/RESET })`
- Keep `executeCommand('view.focusMode')` and `executeCommand('view.typewriterMode')` as-is (existing dispatcher)

#### 2. TabBar

| Current Facade | Replace With |
|---|---|
| `useTabContext()` | `useTabBarReads()` for reads + `mediator.send()` for writes |

**TabBar.vue changes:**
- Remove: `useTabContext`
- Add: `useTabBarReads()`, `useMediator()`
- Replace `tabsCtx.switch(tabId)` → `mediator.send({ type: TabCommands.SWITCH, payload: { tabId } })`
- Replace `tabsCtx.removeTabById(tabId)` → `mediator.send({ type: TabCommands.CLOSE, payload: { tabId } })`
- Keep `useTabActions()` for `createTab`/`closeTab` (these wrap Use Cases)

#### 3. App.vue

| Current Facade | Replace With |
|---|---|
| `useTabContext()` | `useAppReads()` |
| `useLayoutContext()` | `useAppReads()` |

**App.vue changes:**
- Remove: `useTabContext`, `useLayoutContext`
- Add: `useAppReads()`
- Read-only usage, no write calls to replace

#### 4. FileExplorer

| Current Facade | Replace With |
|---|---|
| `useTabContext()` | Direct store access for reads + `mediator.send()` for writes |

**FileExplorer.vue changes:**
- Remove: `useTabContext`
- Add: `useMediator()`
- Replace `tabsCtx.create(...)` → `mediator.send({ type: TabCommands.CREATE, payload: {...} })`
- Replace `tabsCtx.switch(...)` → `mediator.send({ type: TabCommands.SWITCH, payload: { tabId } })`
- File operations use `mediator.send({ type: FileExplorerCommands.* })`

#### 5. FileTreeNode

| Current Facade | Replace With |
|---|---|
| `useTabContext()` | `mediator.send()` for writes |

**FileTreeNode.vue changes:**
- Remove: `useTabContext`
- Add: `useMediator()`
- Replace `tabsCtx.create(...)` → `mediator.send({ type: TabCommands.CREATE })`
- Replace `tabsCtx.switch(...)` → `mediator.send({ type: TabCommands.SWITCH })`

#### 6. RecentFiles

| Current Facade | Replace With |
|---|---|
| `usePreferencesContext()` | `useRecentFilesReads()` for reads + `mediator.send(PreferenceCommands.SET)` |

**RecentFiles.vue changes:**
- Remove: `usePreferencesContext`
- Add: `useRecentFilesReads()`, `useMediator()`
- Replace `prefsCtx.removeRecentFile(...)` → `mediator.send(...)` (or keep direct store call since recentFiles management is in preferences store)

#### 7. Welcome

| Current Facade | Replace With |
|---|---|
| `usePreferencesContext()` | `useWelcomeReads()` for reads + `mediator.send()` for writes |

#### 8. EditorContainer

| Current Facade | Replace With |
|---|---|
| `useTabContext()` | `useEditorContainerReads()` for reads |
| `useEditorContext()` | Keep as-is (EditorContext wraps EditorPool, not a facade) |
| `useViewModeContext()` | `useEditorContainerReads()` for reads |

**Note:** `useEditorContext` is NOT a context facade — it wraps the EditorPool service. Keep it.

#### 9. PlainTextEditor

| Current Facade | Replace With |
|---|---|
| `useTabContext()` | `usePlainTextEditorReads()` for reads |
| `usePreferencesContext()` | `usePlainTextEditorReads()` for reads |

#### 10. CodeMirrorEditor

| Current Facade | Replace With |
|---|---|
| `useTabContext()` | `useCodeMirrorEditorReads()` for reads |
| `usePreferencesContext()` | `useCodeMirrorEditorReads()` for reads |
| `useLayoutContext()` | `useCodeMirrorEditorReads()` for reads |

#### 11. GlobalSearch

| Current Facade | Replace With |
|---|---|
| (Uses search composable) | `useGlobalSearchReads()` + `mediator.send(SearchCommands.*)` |

---

## Phase 4: Files to Create/Modify

### Files to CREATE

| File | Purpose |
|---|---|
| `src/adapters/mediator/handlers/LayoutCommandHandler.ts` | Layout command handlers |
| `src/adapters/mediator/handlers/ViewModeCommandHandler.ts` | ViewMode command handlers |
| `src/adapters/mediator/handlers/PreferenceCommandHandler.ts` | Preference command handlers |
| `src/adapters/mediator/handlers/SearchCommandHandler.ts` | Search command handlers |
| `src/adapters/mediator/handlers/FileExplorerCommandHandler.ts` | FileExplorer command handlers |
| `src/adapters/composables/reads/StatusBar_reads.ts` | StatusBar ISP read interface |
| `src/adapters/composables/reads/TabBar_reads.ts` | TabBar ISP read interface |
| `src/adapters/composables/reads/EditorContainer_reads.ts` | EditorContainer ISP read interface |
| `src/adapters/composables/reads/FileExplorer_reads.ts` | FileExplorer ISP read interface |
| `src/adapters/composables/reads/RecentFiles_reads.ts` | RecentFiles ISP read interface |
| `src/adapters/composables/reads/Welcome_reads.ts` | Welcome ISP read interface |
| `src/adapters/composables/reads/App_reads.ts` | App ISP read interface |
| `src/adapters/composables/reads/GlobalSearch_reads.ts` | GlobalSearch ISP read interface |
| `src/adapters/composables/reads/PlainTextEditor_reads.ts` | PlainTextEditor ISP read interface |
| `src/adapters/composables/reads/CodeMirrorEditor_reads.ts` | CodeMirrorEditor ISP read interface |
| `src/adapters/composables/reads/index.ts` | Barrel export |

### Files to MODIFY

| File | Changes |
|---|---|
| `src/adapters/mediator/commands.ts` | Add LayoutCommands, ViewModeCommands, SearchCommands, FileExplorerCommands, PreferenceCommandsExtended |
| `src/adapters/mediator/index.ts` | Import and call `registerAllCommandHandlers` |
| `src/adapters/mediator/handlers/index.ts` | Add `registerAllCommandHandlers` that calls all domain handlers |
| `src/components/StatusBar/StatusBar.vue` | Replace 4 context facades with ISP reads + mediator |
| `src/components/Tabs/TabBar.vue` | Replace useTabContext with ISP reads + mediator |
| `src/App.vue` | Replace useTabContext + useLayoutContext with ISP reads |
| `src/components/Sidebar/FileExplorer.vue` | Replace useTabContext with mediator |
| `src/components/Sidebar/FileTreeNode.vue` | Replace useTabContext with mediator |
| `src/components/Sidebar/RecentFiles.vue` | Replace usePreferencesContext with ISP reads |
| `src/components/Welcome/Welcome.vue` | Replace usePreferencesContext with ISP reads |
| `src/components/Editor/EditorContainer.vue` | Replace useTabContext + useViewModeContext with ISP reads |
| `src/components/Editor/PlainTextEditor.vue` | Replace useTabContext + usePreferencesContext with ISP reads |
| `src/components/Editor/CodeMirrorEditor.vue` | Replace useTabContext + usePreferencesContext + useLayoutContext with ISP reads |
| `src/components/Sidebar/GlobalSearch.vue` | Replace search context with ISP reads + mediator |

---

## Phase 5: Files to DELETE

After all components are migrated:

| File | Reason |
|---|---|
| `src/adapters/composables/useTabContext.ts` | Replaced by per-component ISP reads |
| `src/adapters/composables/useLayoutContext.ts` | Replaced by per-component ISP reads |
| `src/adapters/composables/usePreferencesContext.ts` | Replaced by per-component ISP reads |
| `src/adapters/composables/useViewModeContext.ts` | Replaced by per-component ISP reads |
| `src/adapters/composables/useSearchContext.ts` | Replaced by per-component ISP reads |
| `src/adapters/composables/useFileContext.ts` | Replaced by per-component ISP reads |

**Keep as-is:**
- `src/adapters/composables/useEditorContext.ts` — NOT a facade, wraps EditorPool service
- `src/adapters/composables/useEditor.ts` — EditorPool wrapper
- `src/adapters/composables/useTabs.ts` — Used by Use Cases
- `src/adapters/composables/useFile.ts` — Used by Use Cases
- `src/adapters/composables/useSearch.ts` — Provides search service to editor
- `src/adapters/composables/useEventBus.ts` — Event bus re-export

---

## Phase 6: Migration Execution Order

```
Step 1: Create all command handlers (Phase 1) — no component changes
Step 2: Create all ISP read interfaces (Phase 2) — no component changes
Step 3: Migrate StatusBar.vue (simplest, validates pattern)
Step 4: Migrate TabBar.vue
Step 5: Migrate App.vue
Step 6: Migrate FileExplorer.vue + FileTreeNode.vue
Step 7: Migrate RecentFiles.vue
Step 8: Migrate Welcome.vue
Step 9: Migrate EditorContainer.vue
Step 10: Migrate PlainTextEditor.vue + CodeMirrorEditor.vue
Step 11: Migrate GlobalSearch.vue
Step 12: Delete context facade files (Phase 5)
Step 13: Run tests + typecheck
Step 14: Commit
```

---

## Quick Reference: Command Mapping

| Current Code | New Code |
|---|---|
| `layout.toggleSidebar()` | `mediator.send({ type: 'layout:toggleSidebar' })` |
| `layout.setSidebar(v)` | `mediator.send({ type: 'layout:setSidebar', payload: { value: v } })` |
| `prefsStore.toggleLightDark()` | `mediator.send({ type: 'preference:toggleLightDark' })` |
| `prefsStore.zoomIn()` | `mediator.send({ type: 'preference:zoomIn' })` |
| `prefsStore.toggleWordCountDisplayType()` | `mediator.send({ type: 'preference:toggleWordCount' })` |
| `viewModeStore.setTypewriterMode(v)` | `mediator.send({ type: 'viewMode:setTypewriter', payload: { value: v } })` |
| `tabsStore.switchTab(id)` | `mediator.send({ type: 'tab:switch', payload: { tabId: id } })` |
| `tabsCtx.create(opts)` | `mediator.send({ type: 'tab:create', payload: opts })` |
| `fileStore.openFolder()` | `mediator.send({ type: 'fileExplorer:openFolder' })` |
| `searchStore.search(config)` | `mediator.send({ type: 'search:search', payload: { config } })` |
