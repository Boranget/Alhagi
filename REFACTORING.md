# 架构重构计划

> 基于全面代码审查，涉及死代码清理、状态管理、组件设计、服务层、性能、安全和**耦合度** 7 个维度。
> 预估工作量：6-8 天（按优先级分阶段执行）

---

## 层次结构分析

### 重构前（当前）— 层次混乱

```
┌─────────────────────────────────────────────────────────────┐
│  Components (组件层)                                        │
│  直接调用 Store、Service、Composable、Manager               │
│  职责：UI 渲染 + 业务逻辑 + 状态管理 + Electron 通信       │
└─────────────────────────────────────────────────────────────┘
        │ ▼ │ ▲ │ ▼ │
┌─────────────────────────────────────────────────────────────┐
│  Composables (组合式函数层)                                 │
│  直接调用 Store、Service、Manager                           │
│  职责：业务逻辑 + 状态管理 + 生命周期                       │
└─────────────────────────────────────────────────────────────┘
        │ ▼ │ ▲ │ ▼ │
┌─────────────────────────────────────────────────────────────┐
│  Stores (状态层)                                            │
│  直接调用其他 Store、Service                                │
│  职责：状态管理 + 业务逻辑 + 持久化 + IPC                   │
└─────────────────────────────────────────────────────────────┘
        │ ▼ │ ▲ │ ▼ │
┌─────────────────────────────────────────────────────────────┐
│  Services (服务层)                                          │
│  直接访问全局单例、调用 Store                               │
│  职责：业务逻辑 + Electron 通信 + 工具函数                  │
└─────────────────────────────────────────────────────────────┘
```

**问题**：
1. 层与层之间双向依赖（Store ↔ Service）
2. 每层职责边界模糊
3. 数据流向不清晰

---

### 重构后（目标）— 层次清晰

```
┌─────────────────────────────────────────────────────────────┐
│  Components (组件层)                                        │
│  职责：UI 渲染 + 用户交互                                   │
│  依赖：仅通过 useAppContext() 访问业务接口                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ inject('appContext')
┌─────────────────────────────────────────────────────────────┐
│  AppContext (业务接口层) ← 新增 Facade                      │
│  职责：统一业务接口 + 隐藏实现细节                          │
│  依赖：Composables + Stores                                 │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│  Composables (组合层)│    │  Stores (状态层)             │
│  职责：可复用逻辑    │    │  职责：状态管理 + 持久化     │
│  依赖：AppContext     │    │  依赖：仅 Services (单向)    │
└──────────────────────┘    └──────────────────────────────┘
              │                           │
              └─────────────┬─────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Services (服务层)                                          │
│  职责：Electron 通信 + 外部 API + 工具函数                  │
│  依赖：无（纯函数或参数注入）                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Infrastructure (基础设施层)                                │
│  职责：EventBus、Electron API、文件系统                     │
│  依赖：无                                                   │
└─────────────────────────────────────────────────────────────┘
```

**改进**：
1. **单向依赖**：Component → AppContext → Composable/Store → Service → Infrastructure
2. **职责清晰**：每层只做一件事
3. **数据流明确**：从上到下，从左到右

---

### 重构前后对比

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 依赖方向 | 双向混乱 | **单向向下** |
| 层间通信 | 直接调用 Store/Service | **通过 AppContext** |
| 职责边界 | 模糊 | **清晰分离** |
| 数据流 | 不明确 | **从上到下** |
| 测试难度 | 高（需 mock 多个依赖） | **低（mock AppContext 即可）** |
| 可维护性 | 低 | **高** |

---

## 耦合度现状分析

### 当前依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│                     Components                          │
│  EditorContainer ──→ tabsStore, prefsStore, viewMode,   │
│                      editorManager                      │
│  StatusBar ────────→ tabsStore, prefsStore, viewMode,   │
│                      layoutStore                        │
│  FileExplorer ─────→ tabsStore, fileExplorerStore,      │
│                      electronService                    │
│  TabBar ───────────→ tabsStore, tabService              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     Composables                         │
│  useApp ───────────→ tabsStore, prefsStore,             │
│                      fileExplorerStore, electronService, │
│                      editorManager, capture, typography  │
│  useWorkspaceSearch→ tabsStore, fileExplorerStore,      │
│                      xssSanitizer                       │
│  useAutoSave ──────→ tabsStore, prefsStore, tabService  │
│  useOutline ───────→ tabsStore, editorManager           │
│  useExport ────────→ tabsStore, editorManager           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      Stores                             │
│  tabs ─────────────→ preferences (直接调用)             │
│  fileExplorer ─────→ preferences (直接调用)             │
│  preferences ──────→ layout (双向同步)                  │
│                      themeService, i18n, recentFiles    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     Services                            │
│  TabService ───────→ tabsStore, prefsStore,             │
│                      editorManager, electronService     │
│  ImageOrchestrator → tabsStore, prefsStore,             │
│                      fileExplorerStore, editorManager   │
│  ElectronEventHandler→ tabsStore, tabService,           │
│                      confirmDialog, toast, commands     │
│  i18n ─────────────→ globalThis.electronAPI (绕过)      │
│  ThemeService ─────→ prefsStore, window.electronAPI     │
│                      (绕过)                             │
└─────────────────────────────────────────────────────────┘
```

### 耦合问题汇总

| 耦合类型 | 问题数量 | 严重程度 |
|----------|----------|----------|
| Store → Store 直接调用 | 3 处 | 高 |
| Service → Store 直接调用 | 8 处 | 高 |
| Service 绕过抽象层访问 API | 2 处 | 中 |
| Composable → Store 直接调用 | 12 处 | 中 |
| 组件 → Store 直接调用 | 15+ 处 | 低 |
| 单例模式不统一 | 4 种实现 | 中 |

---

## 阶段 0：死代码清理（0.5 天）

### 0.1 删除未使用的文件

| 文件 | 行数 | 原因 |
|------|------|------|
| `src/components/Editor/codemirror/CustomCodeMirrorBlock.ts` | ~1000+ | 从未被主流程引用 |
| `src/components/Editor/codemirror/customCodeMirrorPlugin.ts` | 123 | 从未被 import |
| `src/components/Editor/codemirror/crepeTheme.ts` | ~50 | 只被死代码导入 |
| `src/components/Editor/codemirror/loader.ts` | ~30 | 只被死代码导入 |
| `src/plugins/frontmatter/` (整个目录) | ~200+ | 从未 `.use()` |
| `src/components/Sidebar/Sidebar.vue` | ~200+ | 功能不完整旧版本 |

### 0.2 删除死代码函数/变量

| 文件:行号 | 代码 |
|-----------|------|
| `useEditorView.ts:19` | `isResizing` 未使用 |
| `useWorkspaceSearch.ts:367-374` | `replaceInActiveFile()` 未调用 |
| `EditorContainer.vue:109` | `windowHeight` 未使用 |
| `StatusBar.vue:212-233` | 3 个空事件监听器回调 |

---

## 阶段 1：基础设施统一（1.5 天）

### 1.1 统一单例模式 → Pinia Store

将以下单例改为 Pinia store：

| 当前实现 | 目标 | 文件 |
|----------|------|------|
| `crepeEditorManager.ts` 模块级单例 | `useEditorStore` | `stores/editor.ts` |
| `CrepeSearchService.ts` 模块级变量 | `useSearchStore` | `stores/search.ts` |
| `errorHandler.ts` 模块级单例 | `useErrorStore` | `stores/error.ts` |
| `ElectronService.ts` 静态单例 | `useElectronStore` | `stores/electron.ts` |
| `ImageInsertOrchestrator.ts` 模块级单例 | `useImageStore` | `stores/image.ts` |

**新文件结构：**

```
stores/
  editor.ts        # 编辑器管理
  search.ts        # 搜索状态（当前模块级变量）
  error.ts         # 错误管理
  electron.ts      # Electron IPC
  image.ts         # 图片插入
```

### 1.2 统一依赖注入

将以下服务改为构造函数注入：

| 服务 | 当前问题 | 修复 |
|------|----------|------|
| `TabService.ts:13-14` | 构造函数调用 useTabsStore | 通过参数注入 |
| `ElectronEventHandler.ts:32-34` | 构造函数调用多个 composable | 通过参数注入 |
| `ImageInsertOrchestrator.ts:40-43` | 构造函数调用 4 个 store | 通过参数注入 |

### 1.3 修复 ElectronService dispose

```typescript
// ElectronService.ts:65-71
dispose(): void {
  this.eventHandler?.dispose()
  this.initialized = false
  this.api = null
  // 修复：重置静态实例
  ElectronService.instance = null
}
```

---

## 阶段 2：状态管理重构（1 天）

### 2.1 搜索状态纳入 Pinia Store

```typescript
// stores/search.ts
export const useSearchStore = defineStore('search', () => {
  // 当前：模块级变量（CrepeSearchService.ts:19-21）
  const currentQuery = ref<SearchQuery | null>(null)
  const currentMatches = ref<SearchMatch[]>([])
  const currentIndex = ref(-1)
  const searchCache = ref(new SearchCache())

  // 替换 EditorContainer.vue:107-112 的 computed 问题
  function setSearchService(service: SearchService | null) { ... }

  function $reset() {
    currentQuery.value = null
    currentMatches.value = []
    currentIndex.value = -1
    searchCache.value.clear()
  }
})
```

### 2.2 拆分 God Store — `preferences.ts`

将 `preferences.ts`（30+ 个配置项）拆分为：

```typescript
stores/
  preferences/
    index.ts           # 统一导出
    editor.ts          # 编辑器配置
    theme.ts           # 主题配置
    recent.ts          # 最近文件/文件夹
    session.ts         # 会话恢复
    general.ts         # 通用配置
```

### 2.3 消除状态重复

**问题**：`isStickyNoteMode` / `isImmersiveMode` 同时存在于 `preferences.ts` 和 `layout.ts`

**方案**：只在 `layout.ts` 保持运行时状态，`preferences.ts` 只负责持久化：

```typescript
// layout.ts
const isStickyNoteMode = ref(false)

// preferences.ts — 只在初始化时同步一次
watch(() => prefsStore.stickyNoteMode, (v) => {
  layoutStore.isStickyNoteMode = v
})
```

### 2.4 Store 间解耦

| 当前 | 修复 |
|------|------|
| `fileExplorer.ts:31,181` 直接调用 `usePreferencesStore().addRecentFolder()` | 改为 `eventBus.emit(AppEvents.FOLDER_OPENED, path)` |
| `tabs.ts:96,140` 直接调用 `usePreferencesStore().addRecentFile()` | 改为 `eventBus.emit(AppEvents.FILE_OPENED, path)` |
| `tabs.ts:139-142` switchTab 误触发最近文件 | 移除 switchTab 中的 addRecentFile 调用 |

---

## 阶段 2.5：Composable 和组件层解耦（1 天）

### 重构后文件结构

```
src/
├── components/           # 组件层：UI 渲染
│   ├── Editor/
│   ├── Sidebar/
│   └── ...
│
├── composables/          # 组合层：可复用逻辑
│   ├── useAppContext.ts  # ← 新增：业务接口 Facade
│   ├── useTabs.ts        # ← 新增：tabs 业务逻辑
│   ├── useEditor.ts      # ← 新增：editor 业务逻辑
│   ├── useSearch.ts      # ← 新增：search 业务逻辑
│   ├── useFile.ts        # ← 新增：file 业务逻辑
│   ├── useApp.ts         # ← 重构：仅保留应用初始化
│   └── ...
│
├── stores/               # 状态层：状态管理
│   ├── tabs.ts           # 纯状态 + 持久化
│   ├── preferences.ts    # 纯状态 + 持久化
│   ├── editor.ts         # ← 新增：编辑器状态
│   ├── search.ts         # ← 新增：搜索状态
│   └── ...
│
├── services/             # 服务层：外部通信
│   ├── electron/         # Electron IPC
│   ├── image/            # 图片处理
│   ├── search/           # 搜索算法（纯函数）
│   └── ...
│
├── events/               # 基础设施：事件总线
│   └── eventBus.ts
│
└── infrastructure/       # ← 新增：基础设施层
    ├── electron.ts       # Electron API 封装
    └── storage.ts        # 存储抽象
```

### 各层职责与依赖规则

| 层 | 职责 | 可依赖 | 不可依赖 |
|----|------|--------|----------|
| **Components** | UI 渲染 + 用户交互 | AppContext、UI 库 | Store、Service、Manager |
| **AppContext** | 统一业务接口 | Composables、Stores | Components、Infrastructure |
| **Composables** | 可复用业务逻辑 | AppContext、Stores | Components、Infrastructure |
| **Stores** | 状态管理 + 持久化 | Services（单向） | Composables、Components |
| **Services** | 外部通信 + 工具函数 | Infrastructure | Stores、Composables、Components |
| **Infrastructure** | 基础能力封装 | 无 | 所有上层 |

### 依赖规则检查

```bash
# 检查组件层是否直接依赖 Store
grep -r "useTabsStore\|usePreferencesStore" src/components/ --include="*.vue"

# 检查 Store 层是否反向依赖 Composable
grep -r "useAppContext\|useApp" src/stores/ --include="*.ts"

# 检查 Service 层是否依赖 Store
grep -r "useTabsStore\|usePreferencesStore" src/services/ --include="*.ts"
```

### 数据流向图

```
用户操作
    │
    ▼
┌─────────────┐
│  Component  │ ← 用户交互
└──────┬──────┘
       │ emit('action')
       ▼
┌─────────────┐
│  AppContext  │ ← 业务接口
└──────┬──────┘
       │ 调用业务方法
       ▼
┌─────────────┐    ┌─────────────┐
│ Composable  │───▶│   Store     │ ← 状态更新
└──────┬──────┘    └──────┬──────┘
       │                   │ 调用 Service
       │                   ▼
       │            ┌─────────────┐
       │            │  Service    │ ← 外部通信
       │            └──────┬──────┘
       │                   │
       ▼                   ▼
┌─────────────────────────────────┐
│        Infrastructure          │ ← 基础能力
│  (EventBus, Electron API, FS)  │
└─────────────────────────────────┘
```

### 状态更新流程

```
用户点击"新建标签"
    │
    ▼
Component: emit('createTab')
    │
    ▼
AppContext: tabs.create({ title: '无标题' })
    │
    ▼
Composable: useTabs().create()
    │
    ▼
Store: tabsStore.createTab()  ← 更新状态
    │
    ▼
Service: tabService.syncOpenedFiles()  ← IPC 通信
    │
    ▼
Infrastructure: electronService.send('tabs:update', data)
```

### 2.5.1 引入 Store Facade 模式

为 Composable 和组件提供统一的业务接口，隐藏 Store 细节：

```typescript
// composables/useAppContext.ts
export function useAppContext() {
  return {
    // 业务接口（隐藏 Store 实现）
    tabs: {
      activeTab: computed(() => tabsStore.activeTab),
      create: (options) => tabsStore.createTab(options),
      close: (id) => tabsStore.removeTab(id),
      save: (id) => tabService.saveFile(id),
    },
    editor: {
      getMarkdown: () => editorStore.getMarkdown(),
      insertImage: (path, alt) => editorStore.commands.insertImage(path, alt),
    },
    search: {
      search: (query) => searchStore.search(query),
      clear: () => searchStore.clear(),
    },
    file: {
      openFile: () => tabService.openFile(),
      openFolder: () => fileExplorerStore.openFolder(),
    },
  }
}
```

**Facade 设计原则：**

1. **接口最小化**：只暴露必要的业务操作，不暴露 Store 内部实现
2. **按领域分组**：tabs、editor、search、file 四个业务域
3. **类型安全**：使用 TypeScript 接口定义每个域的方法签名
4. **可测试性**：测试时只需 mock AppContext，无需 mock 多个 Store

**潜在问题与解决：**

| 问题 | 解决方案 |
|------|----------|
| Facade 可能变成 God Object | 按领域拆分为多个 Facade：`useTabsContext()`、`useEditorContext()` 等 |
| Facade 隐藏细节导致调试困难 | 保留 `__DEV__` 模式下的 Store 访问能力 |
| Facade 接口设计不当 | 使用 TypeScript 接口约束，遵循 Interface Segregation Principle |
| 性能开销 | Facade 是轻量级包装，无额外性能开销 |

### 2.5.2 Composable 解耦方案

| Composable | 当前依赖 | 解耦后 |
|------------|----------|--------|
| `useApp.ts` | tabsStore, prefsStore, fileExplorerStore, electronService, editorManager, capture, typography | `useAppContext()` + 仅直接依赖的 store |
| `useWorkspaceSearch.ts` | tabsStore, fileExplorerStore, xssSanitizer | `useAppContext()` + xssSanitizer |
| `useAutoSave.ts` | tabsStore, prefsStore, tabService | `useAppContext()` |
| `useOutline.ts` | tabsStore, editorManager | `useAppContext()` |
| `useExport.ts` | tabsStore, editorManager | `useAppContext()` |
| `useWritingEnhancement.ts` | viewModeStore, editorManager | `useAppContext()` |

### 2.5.3 组件解耦方案

组件层通过 `useAppContext()` 或 `provide/inject` 获取业务接口：

```typescript
// 组件中使用
const { tabs, editor, search } = useAppContext()

// 而不是直接调用
// const tabsStore = useTabsStore()
// const prefsStore = usePreferencesStore()
// const editorManager = useCrepeEditorManager()
```

**高耦合组件解耦优先级：**

| 组件 | 当前依赖 Store 数 | 优先级 |
|------|-------------------|--------|
| `EditorContainer.vue` | 4 | P0 |
| `StatusBar.vue` | 4 | P0 |
| `FileExplorer.vue` | 3 | P1 |
| `Welcome.vue` | 4 | P1 |
| `TabBar.vue` | 2 | P2 |
| `DocumentOutline.vue` | 2 | P2 |

### 2.5.4 提供者统一入口

```typescript
// App.vue 中统一 provide
const appContext = useAppContext()
provide('appContext', appContext)

// 子组件中 inject
const app = inject('appContext')
```

---

## 阶段 3：事件驱动改造（1 天）

### 3.1 消除 setTimeout 魔法数字

| 当前 | 目标 |
|------|------|
| `crepeEditorManager.ts:98` `debounce(200ms)` | `eventBus.once(AppEvents.EDITOR_SETTLED, cb)` |
| `useWorkspaceSearch.ts:457` `debounce(300ms)` | `await editorStore.whenIdle()` |
| `FloatingSearch.vue:303` `setTimeout(340ms)` | `requestAnimationFrame` + `MutationObserver` |
| `CrepeSearchService.ts:434` `setTimeout(50ms)` | `view.requestMeasure()` |
| `CustomCodeMirrorBlock.ts:272` `setTimeout(5000ms)` | 删除（死代码） |

### 3.2 修复事件监听器泄漏

| 文件 | 问题 | 修复 |
|------|------|------|
| `TabBar.vue:412-415` | 匿名 wheel 函数无法移除 | 提取为命名函数 + onUnmounted 清理 |
| `ImagePreview.vue:194-220` | onMounted 返回值不被自动清理 | 手动在 onUnmounted 中 removeEventListener |
| `MenuBar.vue:92-100` | 菜单关闭后监听器仍活跃 | 仅在 activeMenu 非空时注册 |
| `CommandPalette.vue:222-229` | 面板关闭后监听器仍活跃 | 仅在 visible 时注册 |
| `useWindowControl.ts:86-93` | resize 匿名函数无法移除 | 提取为命名函数 + onUnmounted 清理 |

### 3.3 新增事件类型

```typescript
// events/eventBus.ts
export const AppEvents = {
  // ... 现有事件
  EDITOR_SETTLED: 'editor:settled' as const,    // 编辑器空闲
  SEARCH_STATE_CHANGED: 'search:state-changed' as const,
  CONTENT_RENDERED: 'editor:content-rendered' as const,
}
```

---

## 阶段 4：组件拆分（1 天）

### 4.1 拆分 God Components

| 组件 | 行数 | 拆分方案 |
|------|------|----------|
| `Icon.vue` 902 行 | 拆分为独立 SVG 图标文件，或使用 `<symbol>` sprite |
| `EditorContainer.vue` 558 行 | 拆分 `SplitEditor.vue`、`useEditorResize.ts` |
| `SettingsPanel.vue` 789 行 | 拆分为 `EditorSettings.vue`、`ThemeSettings.vue` 等 |
| `KeyboardSettings.vue` 594 行 | 拆分 `KeybindingImportExport.ts` composable |
| `DocumentOutline.vue` 485 行 | 拆分 `useOutlineScrollTracker.ts`、`useOutlineDomCache.ts` |
| `FileExplorer.vue` 461 行 | 拆分 `FileContextMenu.vue`、`CreateFileDialog.vue` |

### 4.2 提取共享 CodeMirror Composable

```typescript
// composables/useCodeMirrorEditor.ts
export function useCodeMirrorEditor(options: {
  container: Ref<HTMLElement | null>
  content: Ref<string>
  theme: Ref<string>
  readOnly?: Ref<boolean>
}) {
  // 合并 CodeMirrorEditor.vue 和 PlainTextEditor.vue 的重复逻辑
  const view = shallowRef<EditorView | null>(null)
  const searchService = useSearchService()

  function createView() { ... }
  function updateTheme(theme: string) { ... }
  function destroy() { ... }

  onUnmounted(() => destroy())
  return { view, searchService, createView }
}
```

### 4.3 替换原生 `prompt()`

| 位置 | 修复 |
|------|------|
| `useApp.ts:62` | 使用 `useConfirmDialog` |
| `useExport.ts:87-88` | 使用 `useConfirmDialog` |
| `FileExplorer.vue:411-418` | 使用 `useConfirmDialog` |

---

## 阶段 5：Composable 清理（0.5 天）

### 5.1 消除模块级单例伪装

| 文件 | 修复 |
|------|------|
| `useApp.ts:18` | `isFullscreen` 移入 `useApp()` 内部，返回引用共享的 ref |
| `useToast.ts:8` | `toastRef` 通过 provide/inject 注入 |
| `useConfirmDialog.ts:29-30` | `queue`/`activeResolve` 移入函数内部 |

### 5.2 修复非组件上下文生命周期失效

| 问题 | 修复 |
|------|------|
| `useAutoSave.ts` 被 `useApp.ts:35` 调用 | `useApp` 提供 `onUnmounted` 钩子，或改用 `effectScope` |
| `useFolderOpenHandler.ts` 被 `useApp.ts:39` 同上 | 同上 |

```typescript
// useApp.ts — 使用 effectScope 管理生命周期
const scope = effectScope()

scope.run(() => {
  useAutoSave()
  useFolderOpenHandler()
})

// cleanup 时
scope.stop()
```

### 5.3 定时器/Watcher 清理

| 文件 | 修复 |
|------|------|
| `useOutline.ts` | 收集所有 setTimeout/setInterval ID，onUnmounted 时 clear |
| `useWorkspaceSearch.ts` | navigateLockTimer、debouncedSearch 在 onUnmounted 时清理 |
| `useAutoSave.ts:62-80` | watch 返回值收集到数组，onUnmounted 时 stop |

### 5.4 消除重复逻辑

| 重复 | 统一位置 |
|------|----------|
| `getPlatform()` × 3 | 统一使用 `@/commands/types` 中的导出 |
| `escapeHtml` × 2 | 统一使用 `xssSanitizer.escapeHtml` |
| 搜索结果分组 × 2 | 提取为 `useWorkspaceSearch` 的内部方法 |

---

## 阶段 6：Services 层修复（0.5 天）

### 6.1 修复错误静默吞没

| 位置 | 修复 |
|------|------|
| `capture.ts:31-33, 46-48` | 添加 `console.error` 或 `errorManager.createError` |
| `clipboard.ts:15, 30` | 添加 `await` + `.catch()` |
| `tabService.ts:84-86` | catch 块添加错误日志 |
| `errorHandler.ts:249-253` | handler 异常重新抛出或记录 |
| `NativeClipboardImage.ts:32-33` | 添加 `console.warn` |

### 6.2 统一 Electron API 访问

| 文件 | 修复 |
|------|------|
| `i18n.ts:29` | 改为 `electronService.getAPI().setLanguage()` |
| `ThemeService.ts:21,36` | 改为 `electronService.getAPI().setTheme()` |

### 6.3 添加资源清理

| 服务 | 修复 |
|------|------|
| `TabService` | 添加 `dispose()` 方法，清理 eventBus 订阅 |
| `EditorTypographyService.ts:48` | 返回 dispose 函数 |
| `CrepeSearchService.ts:460` | 在 `clear()` 中 `clearTimeout` |
| `ThemeService.ts` | 添加 `onScopeDispose` 自动清理 listener |

---

## 阶段 7：性能优化（0.5 天）

### 7.1 高开销计算优化

| 位置 | 修复 |
|------|------|
| `StatusBar.vue:135-153` | 使用 `watchEffect` + debounce，或仅在点击时计算 |
| `FileTreeNode.vue:63` | 将 `activeTab` 作为 prop 传入，避免每个节点访问 store |
| `DocumentOutline.vue:317-333` | 缓存 heading 元素列表和 Rect，避免滚动时 DOM 查询 |
| `RecentFiles.vue:187-193` | 合并 4 次 filter 为 1 次遍历 |
| `ShortcutsDialog.vue:118-119` | 预构建 `COMMANDS` Map，排序复杂度 O(n log n) |

### 7.2 响应式优化

| 位置 | 修复 |
|------|------|
| `CodeMirrorEditor.vue:160-185` | 使用 `computed` + 缓存避免全量 diff |
| `useTabDragDrop.ts:28-37` | `dragState` 改用 `shallowReactive` |
| `EnhancedSidebar.vue:34-37` | 非活跃面板改用 `v-if` + `keep-alive` |

### 7.3 DOM 查询优化

| 位置 | 修复 |
|------|------|
| `DocumentOutline.vue:287-303` | 使用 `WeakMap` 缓存 DOM 位置 |
| `DocumentOutline.vue:170` | 缓存 heading 列表，监听 DOM 变化更新 |
| `MenuBar.vue:92-100` | 仅在菜单激活时注册全局监听 |

---

## 阶段 8：安全修复（0.5 天）

### 8.1 XSS 防护

| 位置 | 修复 |
|------|------|
| `GlobalSearch.vue:160` | `v-html` 改为 `v-text`，或确保 `highlightedText` 已转义 |
| `xssSanitizer.ts:77-176` | 重命名 `sanitizeHtml` → `sanitizeToPlainText`，或修复返回值 |

### 8.2 类型安全

| 位置 | 修复 |
|------|------|
| `OutlineTreeItem.vue:28` | `any` → `HeadingTreeNode` |
| `EditorContainer.vue:244-253` | `unknown` → 使用 debounce 泛型签名 |

---

## 执行顺序

```
阶段 0: 死代码清理
  ↓
阶段 1: 基础设施统一（Pinia store、DI）
  ↓
阶段 2: 状态管理重构
  ↓
阶段 2.5: Composable 和组件层解耦（Store Facade）
  ↓
阶段 3: 事件驱动改造
  ↓
阶段 4: 组件拆分
  ↓
阶段 5: Composable 清理
  ↓
阶段 6: Services 层修复
  ↓
阶段 7: 性能优化
  ↓
阶段 8: 安全修复
```

**依赖关系**：
- 阶段 1 必须在阶段 2 之前（Pinia store 是状态重构的基础）
- 阶段 2 必须在阶段 2.5 之前（Facade 依赖新的 store 接口）
- 阶段 2.5 必须在阶段 3 之前（事件驱动需要 Facade 接口）
- 阶段 4-8 可并行执行

---

## 验证检查点

每个阶段完成后运行：

```bash
# 类型检查
npm run typecheck

# 单元测试
npm run test

# 构建验证
npm run build

# Lint
npm run lint
```

---

## 风险项

| 风险 | 缓解措施 |
|------|----------|
| Pinia store 迁移可能引入状态丢失 | 每个 store 实现 `$reset()` + 单元测试覆盖 |
| 事件驱动改造可能引入新的竞态 | 添加时序相关的集成测试 |
| 组件拆分可能破坏现有 UI | 每个拆分后手动验证 UI 交互 |
| 死代码删除可能遗漏引用 | 删除前全局搜索确认无引用 |
| Facade 模式可能增加间接层 | 仅对高耦合场景使用，低耦合保持直接调用 |
| **Facade 可能变成 God Object** | 按领域拆分：useTabsContext()、useEditorContext() 等 |
| **层次规则可能被破坏** | 添加 ESLint 规则检查依赖方向 |
| **AppContext 接口设计不当** | 使用 TypeScript 接口约束，遵循 Interface Segregation Principle |

---

## ESLint 规则（可选）

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // 禁止组件层直接依赖 Store
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@/stores',
        message: 'Components should use useAppContext() instead of direct Store access'
      }]
    }],
    // 禁止 Store 层反向依赖 Composable
    'import/no-restricted-paths': ['error', {
      zones: [{
        target: './src/stores',
        from: './src/composables',
        message: 'Stores should not depend on Composables'
      }]
    }]
  }
}
```

---

## 耦合度降低验证指标

### 重构前后对比

| 指标 | 重构前 | 重构后目标 |
|------|--------|------------|
| Store → Store 直接调用 | 3 处 | 0 处 |
| Service → Store 直接调用 | 8 处 | 2 处（仅通过 Facade） |
| Composable → Store 直接调用 | 12 处 | 0 处（通过 Facade） |
| 组件 → Store 直接调用 | 15+ 处 | 3 处（仅简单组件） |
| 单例模式实现 | 4 种 | 1 种（Pinia store） |
| Service 构造函数依赖 Store | 3 个 | 0 个（参数注入） |

### 依赖关系简化

```
重构前：
Component → Composable → Store → Store
Component → Store
Component → Service → Store

重构后：
Component → Composable → Facade → Store
Component → Facade → Store
Service → Facade（参数注入）
```

### 自动化验证脚本

```bash
# 检查 Store 间直接调用
grep -r "usePreferencesStore\|useTabsStore\|useLayoutStore" src/stores/ --include="*.ts" | grep -v "index.ts"

# 检查 Service 构造函数依赖
grep -r "constructor.*use\w*Store" src/services/ --include="*.ts"

# 检查绕过抽象层的 API 访问
grep -r "window.electronAPI\|globalThis.electronAPI" src/ --include="*.ts" --include="*.vue"
```
