# Clean Architecture 重构计划

> 基于全面代码审查和 Clean Architecture 原则，制定详细的重构方案。
> 预估工作量：8-10 天（按优先级分阶段执行）

---

## 一、当前架构分析

### 1.1 项目概览

| 维度 | 现状 |
|------|------|
| 技术栈 | Vue 3 + Pinia + Electron + Milkdown/Crepe + CodeMirror |
| 代码规模 | 128 个源文件（89 .ts + 36 .vue + 2 .scss + 1 .d.ts） |
| 组件数 | 35 个 Vue 组件 |
| Store 数 | 9 个 Pinia Store |
| Composable 数 | 21 个组合式函数 |
| 服务数 | 12 个服务类 |

### 1.2 主要耦合点

#### 耦合点 1：Store ↔ Service 循环依赖

```
stores/preferences.ts ↔ services/theme/ThemeService.ts
stores/preferences.ts ↔ services/recentFiles/RecentFilesService.ts
```

**问题**：双向依赖导致启动顺序脆弱，目前通过懒实例化缓解。

#### 耦合点 2：Service → Composable 反向依赖

```
services/electron/ElectronEventHandler.ts → composables/useConfirmDialog.ts
services/electron/ElectronEventHandler.ts → composables/useToast.ts
commands/handlers/index.ts → composables/useConfirmDialog.ts
commands/handlers/index.ts → composables/useWritingEnhancement.ts
```

**问题**：违反分层原则（Service 层不应依赖 Composable 层）。

#### 耦合点 3：组件直接导入 Store

| 组件 | 直接依赖 Store 数 |
|------|-------------------|
| CodeMirrorEditor.vue | 3 (tabs, preferences, layout) |
| Welcome.vue | 3 (preferences, tabs, fileExplorer) |
| FileExplorer.vue | 2 (fileExplorer, tabs) |
| TabBar.vue | 1 (tabs) |
| SettingsPanel.vue | 1 (preferences) |

**问题**：组件与具体 Store 实现紧耦合，难以测试和维护。

#### 耦合点 4：God Store — preferences.ts

| 指标 | 数值 |
|------|------|
| 代码行数 | 409 行 |
| 配置项数量 | 30+ 个 |
| 依赖模块数 | 7 个 |
| 被依赖次数 | 10+ 次 |

**问题**：职责过重，承担了偏好持久化、主题副效应、语言切换、缩放、会话管理、最近文件管理。

#### 耦合点 5：EventBus 与 Store 响应式并存

```
tabs store 内部 emit 事件
  → 调用方需同时关注 Pinia 响应式和 eventBus 通知
  → 两个通信通道增加心智负担
```

### 1.3 可优化方向

| 方向 | 问题 | 优化目标 |
|------|------|----------|
| 依赖方向 | 双向混乱 | 单向向下（Component → Service → Domain → Infrastructure） |
| 职责边界 | 模糊 | 每层只做一件事 |
| 数据流 | 不明确 | 从上到下，清晰可追踪 |
| 可测试性 | 高（需 mock 多个依赖） | 低（mock 接口即可） |
| 循环依赖 | 2 处 | 0 处 |

---

## 二、Clean Architecture 目标架构

### 2.1 分层模型

```
┌─────────────────────────────────────────────────────────────┐
│                    外部层（Frameworks & Drivers）              │
│  Vue 组件、Pinia Store、Electron IPC、Milkdown/CodeMirror    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ 依赖方向：向内
┌─────────────────────────────────────────────────────────────┐
│                    接口层（Interface Adapters）                │
│  Composables、Store 适配器、Presenter、Gateway                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ 依赖方向：向内
┌─────────────────────────────────────────────────────────────┐
│                    应用层（Application Business Rules）        │
│  Use Cases、Application Services、DTOs                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ 依赖方向：向内
┌─────────────────────────────────────────────────────────────┐
│                    核心层（Enterprise Business Rules）         │
│  Domain Entities、Value Objects、Repository Interfaces       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 依赖规则

1. **依赖只能指向内层**：外层依赖内层，内层不知道外层的存在
2. **接口在内层定义**：Repository、Gateway 等接口在核心层定义
3. **实现在外层**：具体实现（Electron IPC、Pinia Store）在外层
4. **框架独立性**：核心层不依赖任何框架（Vue、Pinia、Electron）

### 2.3 重构后目录结构

```
src/
├── core/                           # 核心层：企业业务规则
│   ├── entities/                   # 实体
│   │   ├── Tab.ts                  # Tab 实体
│   │   ├── FileNode.ts             # 文件节点实体
│   │   ├── EditorState.ts          # 编辑器状态实体
│   │   ├── Preferences.ts          # 偏好设置实体
│   │   └── Search.ts               # 搜索实体
│   │
│   ├── interfaces/                 # 接口定义
│   │   ├── repositories/           # Repository 接口
│   │   │   ├── ITabRepository.ts
│   │   │   ├── IFileRepository.ts
│   │   │   ├── IPreferencesRepository.ts
│   │   │   └── ISearchRepository.ts
│   │   ├── gateways/               # Gateway 接口
│   │   │   ├── IEventBus.ts
│   │   │   ├── IFileSystem.ts
│   │   │   ├── IIPC.ts
│   │   │   └── IStorage.ts
│   │   └── services/               # 服务接口
│   │       ├── IEditorService.ts
│   │       ├── IThemeService.ts
│   │       └── IFileWatcherService.ts
│   │
│   └── use-cases/                  # 用例
│       ├── tabs/                   # Tab 相关用例
│       │   ├── CreateTab.ts
│       │   ├── CloseTab.ts
│       │   ├── SwitchTab.ts
│       │   └── UpdateTab.ts
│       ├── file/                   # 文件相关用例
│       │   ├── OpenFile.ts
│       │   ├── SaveFile.ts
│       │   ├── CreateFile.ts
│       │   └── DeleteFile.ts
│       ├── editor/                 # 编辑器相关用例
│       │   ├── InitEditor.ts
│       │   ├── GetMarkdown.ts
│       │   └── SetViewMode.ts
│       ├── search/                 # 搜索相关用例
│       │   ├── SearchInFile.ts
│       │   ├── SearchInFolder.ts
│       │   └── ReplaceInFile.ts
│       └── preferences/            # 偏好相关用例
│           ├── UpdatePreference.ts
│           └── SyncPreferences.ts
│
├── adapters/                       # 接口层：适配器
│   ├── composables/                # Vue 组合式函数（Presenter）
│   │   ├── useAppContext.ts        # 统一业务接口 Facade
│   │   ├── useTabs.ts             # Tab 业务逻辑
│   │   ├── useEditor.ts           # 编辑器业务逻辑
│   │   ├── useFile.ts             # 文件业务逻辑
│   │   ├── useSearch.ts           # 搜索业务逻辑
│   │   ├── usePreferences.ts      # 偏好业务逻辑
│   │   ├── useApp.ts              # 应用初始化
│   │   └── ... (其他 composable)
│   │
│   ├── stores/                     # Pinia Store（Gateway 实现）
│   │   ├── tabs.ts                 # Tab Repository 实现
│   │   ├── preferences.ts          # Preferences Repository 实现
│   │   ├── layout.ts               # Layout 状态
│   │   ├── viewMode.ts             # ViewMode 状态
│   │   └── fileExplorer.ts         # File Explorer 状态
│   │
│   └── gateways/                   # Gateway 实现
│       ├── EventBusGateway.ts      # EventBus 实现
│       ├── ElectronIPCGateway.ts   # Electron IPC 实现
│       ├── FileSystemGateway.ts    # 文件系统实现
│       └── StorageGateway.ts       # 存储实现
│
├── infrastructure/                 # 外部层：框架和驱动
│   ├── electron/                   # Electron 主进程
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   ├── context.ts
│   │   ├── services/
│   │   └── ipc-handler.ts
│   │
│   ├── vue/                        # Vue 框架相关
│   │   ├── App.vue
│   │   ├── main.ts
│   │   └── components/             # UI 组件
│   │       ├── Editor/
│   │       ├── Sidebar/
│   │       ├── Tabs/
│   │       └── ...
│   │
│   ├── editors/                    # 编辑器框架
│   │   ├── milkdown/               # Milkdown/Crepe
│   │   ├── codemirror/             # CodeMirror
│   │   └── plugins/                # 编辑器插件
│   │
│   └── services/                   # 基础服务实现
│       ├── electron/
│       │   ├── ElectronService.ts
│       │   └── ElectronEventHandler.ts
│       ├── search/
│       │   ├── CrepeSearchService.ts
│       │   └── CodeMirrorSearchService.ts
│       ├── theme/
│       │   └── ThemeService.ts
│       ├── i18n/
│       │   └── i18n.ts
│       ├── capture.ts
│       ├── clipboard.ts
│       └── xssSanitizer.ts
│
├── shared/                         # 共享层：跨层共享
│   ├── types/                      # 类型定义
│   │   ├── index.ts
│   │   └── ...
│   ├── constants/                  # 常量
│   │   └── index.ts
│   └── utils/                      # 工具函数
│       ├── helpers.ts
│       └── ...
│
└── electron-protocol/              # 共享契约层（主进程 ↔ 渲染端）
    ├── channels.ts
    ├── responses.ts
    ├── electron-api.ts
    ├── commands/
    └── i18n/
```

---

## 三、各模块职责说明

### 3.1 核心层（core/）

#### Entities（实体）

| 实体 | 职责 | 属性 |
|------|------|------|
| `Tab` | 标签页实体 | id, filePath, title, content, isDirty, viewMode, fileType, splitRatio |
| `FileNode` | 文件节点实体 | path, name, isDirectory, children, isExpanded |
| `EditorState` | 编辑器状态实体 | isReady, activeEditor, cursorPosition, viewMode |
| `Preferences` | 偏好设置实体 | theme, zoom, fontSize, lineHeight, language, autoSave |
| `Search` | 搜索实体 | query, matches, currentIndex, total |

#### Interfaces（接口）

**Repository 接口**：

```typescript
// ITabRepository.ts
export interface ITabRepository {
  getAll(): Tab[]
  getById(id: string): Tab | undefined
  create(tab: Omit<Tab, 'id'>): Tab
  update(id: string, updates: Partial<Tab>): void
  delete(id: string): void
  getActiveTab(): Tab | undefined
  setActiveTab(id: string): void
}
```

```typescript
// IPreferencesRepository.ts
export interface IPreferencesRepository {
  get<K extends keyof Preferences>(key: K): Preferences[K]
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void>
  getAll(): Preferences
  subscribe(listener: (patch: Partial<Preferences>) => void): () => void
}
```

**Gateway 接口**：

```typescript
// IEventBus.ts
export interface IEventBus {
  on<E extends keyof AppEvents>(event: E, callback: (payload: AppEvents[E]) => void): () => void
  off<E extends keyof AppEvents>(event: E, callback: (payload: AppEvents[E]) => void): void
  emit<E extends keyof AppEvents>(event: E, payload?: AppEvents[E]): void
}
```

```typescript
// IFileSystem.ts
export interface IFileSystem {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  readdir(path: string): Promise<string[]>
  stat(path: string): Promise<{ isDirectory: boolean; size: number }>
  watch(path: string, callback: (event: string, path: string) => void): () => void
}
```

#### Use Cases（用例）

```typescript
// CreateTab.ts
export class CreateTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(options?: CreateTabOptions): Promise<Tab> {
    const tab = this.tabRepository.create({
      filePath: options?.filePath,
      title: options?.title || '无标题',
      content: options?.content || '',
      isDirty: false,
      viewMode: options?.viewMode || 'wysiwyg',
      fileType: options?.fileType || 'markdown',
      splitRatio: options?.splitRatio || 1,
    })

    this.eventBus.emit('TAB_CREATED', { tabId: tab.id, tab })
    return tab
  }
}
```

### 3.2 接口层（adapters/）

#### Composables（Presenter）

| Composable | 职责 | 依赖 |
|------------|------|------|
| `useAppContext` | 统一业务接口 Facade | Use Cases |
| `useTabs` | Tab 业务逻辑 | CreateTab, CloseTab, SwitchTab |
| `useEditor` | 编辑器业务逻辑 | InitEditor, GetMarkdown |
| `useFile` | 文件业务逻辑 | OpenFile, SaveFile |
| `useSearch` | 搜索业务逻辑 | SearchInFile, SearchInFolder |
| `usePreferences` | 偏好业务逻辑 | UpdatePreference |

#### Stores（Gateway 实现）

| Store | 实现接口 | 职责 |
|-------|----------|------|
| `tabs` | `ITabRepository` | Tab CRUD + 状态管理 |
| `preferences` | `IPreferencesRepository` | 偏好持久化 + 广播 |
| `layout` | 独立 | 窗口布局状态 |
| `viewMode` | 独立 | 写作辅助视图模式 |

#### Gateways（Gateway 实现）

| Gateway | 实现接口 | 职责 |
|---------|----------|------|
| `EventBusGateway` | `IEventBus` | 事件总线实现 |
| `ElectronIPCGateway` | `IIPC` | Electron IPC 封装 |
| `FileSystemGateway` | `IFileSystem` | 文件系统操作 |
| `StorageGateway` | `IStorage` | 本地存储 |

### 3.3 外部层（infrastructure/）

| 模块 | 职责 |
|------|------|
| `electron/` | Electron 主进程：窗口管理、IPC、菜单、文件监听 |
| `vue/` | Vue 框架：组件、路由、生命周期 |
| `editors/` | 编辑器框架：Milkdown/Crepe、CodeMirror |
| `services/` | 基础服务：搜索、主题、国际化、剪贴板 |

### 3.4 共享层（shared/）

| 模块 | 职责 |
|------|------|
| `types/` | 类型定义：实体、DTO、事件 |
| `constants/` | 常量：配置、枚举 |
| `utils/` | 工具函数：纯函数 |

---

## 四、关键接口定义

### 4.1 核心接口

```typescript
// core/interfaces/repositories/ITabRepository.ts
export interface ITabRepository {
  getAll(): Tab[]
  getById(id: string): Tab | undefined
  create(tab: Omit<Tab, 'id'>): Tab
  update(id: string, updates: Partial<Tab>): void
  delete(id: string): void
  getActiveTab(): Tab | undefined
  setActiveTab(id: string): void
  getDirtyTabs(): Tab[]
  markDirty(id: string): void
  markClean(id: string): void
}
```

```typescript
// core/interfaces/repositories/IPreferencesRepository.ts
export interface IPreferencesRepository {
  get<K extends keyof Preferences>(key: K): Preferences[K]
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void>
  setMany(prefs: Partial<Preferences>): Promise<void>
  getAll(): Preferences
  subscribe(listener: (patch: Partial<Preferences>) => void): () => void
}
```

```typescript
// core/interfaces/gateways/IEventBus.ts
export interface IEventBus {
  on<E extends keyof AppEvents>(event: E, callback: (payload: AppEvents[E]) => void): () => void
  off<E extends keyof AppEvents>(event: E, callback: (payload: AppEvents[E]) => void): void
  emit<E extends keyof AppEvents>(event: E, payload?: AppEvents[E]): void
  once<E extends keyof AppEvents>(event: E, callback: (payload: AppEvents[E]) => void): () => void
}
```

```typescript
// core/interfaces/gateways/IFileSystem.ts
export interface IFileSystem {
  readFile(path: string): Promise<string>
  readBinary(path: string): Promise<{ data: string; mimeType: string }>
  writeFile(path: string, content: string): Promise<void>
  writeBinary(path: string, data: string, mimeType: string): Promise<void>
  exists(path: string): Promise<boolean>
  existsBatch(paths: string[]): Promise<boolean[]>
  mkdir(path: string): Promise<void>
  readdir(path: string): Promise<DirectoryEntry[]>
  stat(path: string): Promise<{ isDirectory: boolean; size: number }>
  rename(oldPath: string, newPath: string): Promise<void>
  delete(path: string): Promise<void>
  watch(path: string, callback: (event: string, path: string) => void): () => void
}
```

```typescript
// core/interfaces/gateways/IStorage.ts
export interface IStorage {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  delete(key: string): void
  has(key: string): boolean
  clear(): void
}
```

### 4.2 用例接口

```typescript
// core/use-cases/tabs/CreateTab.ts
export interface CreateTabOptions {
  filePath?: string
  content?: string
  title?: string
  viewMode?: ViewMode
  fileType?: FileType
  splitRatio?: number
}

export class CreateTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(options?: CreateTabOptions): Promise<Tab>
}
```

```typescript
// core/use-cases/file/OpenFile.ts
export interface OpenFileOptions {
  filePath?: string
  folderPath?: string
}

export class OpenFile {
  constructor(
    private fileSystem: IFileSystem,
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(options?: OpenFileOptions): Promise<Tab | null>
}
```

```typescript
// core/use-cases/editor/InitEditor.ts
export class InitEditor {
  constructor(
    private editorService: IEditorService,
    private eventBus: IEventBus
  ) {}

  async execute(container: HTMLElement, content: string, tabId: string): Promise<void>
}
```

### 4.3 服务接口

```typescript
// core/interfaces/services/IEditorService.ts
export interface IEditorService {
  init(container: HTMLElement, content: string, tabId: string): Promise<void>
  destroy(): void
  isReady(): boolean
  getMarkdown(): string
  setMarkdown(content: string): void
  getHTML(): string
  getView(): unknown
  getCrepe(): unknown
  getCommands(): unknown
  setViewMode(mode: ViewMode): void
  getViewMode(): ViewMode
  onCursorChange(handler: (from: number, to: number) => void): () => void
  getHeadingsWithPos(): Heading[]
  scrollToHeading(text: string, line: number, pos?: number): void
}
```

```typescript
// core/interfaces/services/IThemeService.ts
export interface IThemeService {
  applyTheme(theme: 'light' | 'dark' | 'system'): void
  getCurrentTheme(): 'light' | 'dark' | 'system'
  onThemeChange(callback: (theme: 'light' | 'dark' | 'system') => void): () => void
}
```

---

## 五、迁移步骤顺序

### 阶段 0：准备（0.5 天）

#### 0.1 创建目录结构

```bash
mkdir -p src/core/entities
mkdir -p src/core/interfaces/repositories
mkdir -p src/core/interfaces/gateways
mkdir -p src/core/interfaces/services
mkdir -p src/core/use-cases/tabs
mkdir -p src/core/use-cases/file
mkdir -p src/core/use-cases/editor
mkdir -p src/core/use-cases/search
mkdir -p src/core/use-cases/preferences
mkdir -p src/adapters/composables
mkdir -p src/adapters/stores
mkdir -p src/adapters/gateways
mkdir -p src/infrastructure/electron
mkdir -p src/infrastructure/vue
mkdir -p src/infrastructure/editors
mkdir -p src/infrastructure/services
mkdir -p src/shared/types
mkdir -p src/shared/constants
mkdir -p src/shared/utils
```

#### 0.2 配置 TypeScript 路径别名

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/core/*"],
      "@adapters/*": ["src/adapters/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### 阶段 1：核心层（1.5 天）

#### 1.1 实现实体（0.5 天）

创建 `src/core/entities/` 下的实体类：

```typescript
// Tab.ts
export class Tab {
  constructor(
    public readonly id: string,
    public filePath: string | undefined,
    public title: string,
    public content: string,
    public isDirty: boolean,
    public viewMode: ViewMode,
    public fileType: FileType,
    public splitRatio: number
  ) {}

  static create(options: CreateTabOptions): Tab {
    return new Tab(
      generateId(),
      options.filePath,
      options.title || '无标题',
      options.content || '',
      false,
      options.viewMode || 'wysiwyg',
      options.fileType || 'markdown',
      options.splitRatio || 1
    )
  }

  markDirty(): void {
    this.isDirty = true
  }

  markClean(): void {
    this.isDirty = false
  }
}
```

#### 1.2 定义接口（0.5 天）

创建 `src/core/interfaces/` 下的所有接口文件。

#### 1.3 实现用例（0.5 天）

创建 `src/core/use-cases/` 下的所有用例类。

### 阶段 2：适配器层（2 天）

#### 2.1 实现 Gateway（0.5 天）

创建 `src/adapters/gateways/` 下的 Gateway 实现：

```typescript
// EventBusGateway.ts
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'
import { eventBus } from '@/events/eventBus'

export class EventBusGateway implements IEventBus {
  on<E extends keyof AppEvents>(event: E, callback: (payload: AppEvents[E]) => void): () => void {
    return eventBus.on(event, callback)
  }

  off<E extends keyof AppEvents>(event: E, callback: (payload: AppEvents[E]) => void): void {
    eventBus.off(event, callback)
  }

  emit<E extends keyof AppEvents>(event: E, payload?: AppEvents[E]): void {
    eventBus.emit(event, payload)
  }

  once<E extends keyof AppEvents>(event: E, callback: (payload: AppEvents[E]) => void): () => void {
    return eventBus.once(event, callback)
  }
}
```

#### 2.2 实现 Repository（0.5 天）

创建 `src/adapters/stores/` 下的 Repository 实现：

```typescript
// tabs.ts
import type { ITabRepository } from '@core/interfaces/repositories/ITabRepository'
import { Tab } from '@core/entities/Tab'
import { defineStore } from 'pinia'

export const useTabRepository = defineStore('tabs', (): ITabRepository => {
  const tabs = ref<Map<string, Tab>>(new Map())
  const activeTabId = ref<string | null>(null)

  const getAll = (): Tab[] => Array.from(tabs.value.values())
  const getById = (id: string): Tab | undefined => tabs.value.get(id)
  const create = (tabData: Omit<Tab, 'id'>): Tab => {
    const tab = Tab.create(tabData)
    tabs.value.set(tab.id, tab)
    return tab
  }
  const update = (id: string, updates: Partial<Tab>): void => {
    const tab = tabs.value.get(id)
    if (tab) Object.assign(tab, updates)
  }
  const delete = (id: string): void => {
    tabs.value.delete(id)
  }
  const getActiveTab = (): Tab | undefined => {
    return activeTabId.value ? tabs.value.get(activeTabId.value) : undefined
  }
  const setActiveTab = (id: string): void => {
    activeTabId.value = id
  }
  const getDirtyTabs = (): Tab[] => {
    return getAll().filter(tab => tab.isDirty)
  }
  const markDirty = (id: string): void => {
    const tab = getById(id)
    if (tab) tab.markDirty()
  }
  const markClean = (id: string): void => {
    const tab = getById(id)
    if (tab) tab.markClean()
  }

  return {
    getAll,
    getById,
    create,
    update,
    delete,
    getActiveTab,
    setActiveTab,
    getDirtyTabs,
    markDirty,
    markClean
  }
})
```

#### 2.3 重构 Composables（1 天）

将现有 composables 重构为使用 Use Cases：

```typescript
// useTabs.ts
import { CreateTab } from '@core/use-cases/tabs/CreateTab'
import { CloseTab } from '@core/use-cases/tabs/CloseTab'
import { SwitchTab } from '@core/use-cases/tabs/SwitchTab'
import { useTabRepository } from '@adapters/stores/tabs'
import { useEventBusGateway } from '@adapters/gateways/EventBusGateway'

export function useTabs() {
  const tabRepository = useTabRepository()
  const eventBus = useEventBusGateway()

  const createTab = new CreateTab(tabRepository, eventBus)
  const closeTab = new CloseTab(tabRepository, eventBus)
  const switchTab = new SwitchTab(tabRepository, eventBus)

  return {
    create: (options?: CreateTabOptions) => createTab.execute(options),
    close: (id: string) => closeTab.execute(id),
    switch: (id: string) => switchTab.execute(id),
    // ... 其他方法
  }
}
```

### 阶段 3：解耦循环依赖（1 天）

#### 3.1 解耦 preferences ↔ ThemeService

```typescript
// 使用 Dependency Injection
// core/use-cases/preferences/UpdatePreference.ts
export class UpdatePreference {
  constructor(
    private preferencesRepository: IPreferencesRepository,
    private themeService: IThemeService,
    private eventBus: IEventBus
  ) {}

  async execute<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void> {
    await this.preferencesRepository.set(key, value)

    // 副作用在 Use Case 中处理
    if (key === 'theme') {
      this.themeService.applyTheme(value as 'light' | 'dark' | 'system')
    }

    this.eventBus.emit('PREFERENCES_CHANGED', { key, value })
  }
}
```

#### 3.2 解耦 preferences ↔ RecentFilesService

```typescript
// 使用事件驱动
// core/use-cases/tabs/CreateTab.ts
export class CreateTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(options?: CreateTabOptions): Promise<Tab> {
    const tab = this.tabRepository.create(options)
    this.eventBus.emit('TAB_CREATED', { tabId: tab.id, tab })

    // 最近文件由 preferences store 监听事件处理
    if (options?.filePath) {
      this.eventBus.emit('FILE_OPENED', { filePath: options.filePath })
    }

    return tab
  }
}
```

### 阶段 4：组件解耦（1 天）

#### 4.1 推进 useAppContext 采用

```typescript
// 所有组件通过 useAppContext() 访问业务操作
// Before
import { useTabsStore } from '@/stores/tabs'
const tabsStore = useTabsStore()

// After
import { useAppContext } from '@adapters/composables/useAppContext'
const { tabs } = useAppContext()
```

#### 4.2 组件迁移优先级

| 优先级 | 组件 | 当前依赖 Store 数 |
|--------|------|-------------------|
| P0 | EditorContainer.vue | 4 |
| P0 | StatusBar.vue | 4 |
| P1 | FileExplorer.vue | 3 |
| P1 | Welcome.vue | 3 |
| P2 | TabBar.vue | 2 |
| P2 | DocumentOutline.vue | 2 |

### 阶段 5：拆分 God Store（1 天）

#### 5.1 拆分 preferences.ts

```typescript
// adapters/stores/preferences/
├── index.ts           # 统一导出
├── editor.ts          # 编辑器配置
├── theme.ts           # 主题配置
├── recent.ts          # 最近文件/文件夹
├── session.ts         # 会话恢复
└── general.ts         # 通用配置
```

#### 5.2 消除 Thin Proxy Store

将 `editor.ts`、`error.ts`、`electron.ts` 降级为普通导出的 singleton 对象：

```typescript
// Before
export const useEditorStore = defineStore('editor', () => {
  const manager = useCrepeEditorManager()
  return { ...manager }
})

// After
export function useEditorManager() {
  return useCrepeEditorManager()
}
```

### 阶段 6：验证和优化（1 天）

#### 6.1 运行测试

```bash
npm run typecheck
npm run test
npm run build
npm run lint
```

#### 6.2 添加 ESLint 规则

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
        target: './src/adapters/stores',
        from: './src/adapters/composables',
        message: 'Stores should not depend on Composables'
      }]
    }]
  }
}
```

---

## 六、验证检查点

### 6.1 每阶段验证

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

### 6.2 依赖方向验证

```bash
# 检查核心层是否依赖外层
grep -r "import.*from.*@/infrastructure" src/core/ --include="*.ts"

# 检查组件层是否直接依赖 Store
grep -r "useTabsStore\|usePreferencesStore" src/infrastructure/vue/components/ --include="*.vue"

# 检查是否有循环依赖
npx madge --circular src/
```

### 6.3 重构前后对比

| 指标 | 重构前 | 重构后目标 |
|------|--------|------------|
| Store ↔ Service 循环依赖 | 2 处 | 0 处 |
| Service → Composable 反向依赖 | 4 处 | 0 处 |
| 组件 → Store 直接调用 | 15+ 处 | 3 处（仅简单组件） |
| 单例模式实现 | 4 种 | 1 种（Pinia store） |
| Service 构造函数依赖 Store | 3 个 | 0 个（参数注入） |
| 依赖方向 | 双向混乱 | 单向向下 |

---

## 七、风险和缓解措施

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

## 八、总结

### 重构目标

1. **依赖方向清晰**：Component → Service → Domain → Infrastructure
2. **职责边界明确**：每层只做一件事
3. **数据流可追踪**：从上到下，清晰可见
4. **可测试性提升**：mock 接口即可测试
5. **可维护性提升**：修改影响范围可控

### 关键原则

1. **依赖规则**：依赖只能指向内层
2. **接口隔离**：每个接口只暴露必要的方法
3. **单一职责**：每个类/模块只做一件事
4. **开闭原则**：对扩展开放，对修改关闭
5. **里氏替换**：子类可以替换父类

### 预期收益

| 收益 | 说明 |
|------|------|
| 代码质量 | 依赖方向清晰，职责边界明确 |
| 可测试性 | mock 接口即可测试，无需 mock 多个依赖 |
| 可维护性 | 修改影响范围可控，降低回归风险 |
| 可扩展性 | 新增功能只需实现接口，无需修改现有代码 |
| 团队协作 | 架构清晰，降低沟通成本 |
