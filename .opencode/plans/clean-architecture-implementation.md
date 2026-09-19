# Alhagi Clean Architecture 实施计划

## 概览

将现有架构迁移到标准的 Clean Architecture，解决所有架构债务（P0-P2 问题）。

---

## 目标架构分层

```
src/
├── core/                          # Domain Layer (纯业务逻辑，零框架依赖)
│   ├── domain/
│   │   ├── entities/              # 聚合根实体
│   │   ├── value-objects/         # 值对象
│   │   ├── events/                # 领域事件
│   │   └── ports/                 # 接口端口
│   ├── application/
│   │   ├── commands/              # 写操作
│   │   ├── queries/               # 读操作
│   │   └── use-cases/             # 组合用例
│   └── shared/                    # 共享内核
│
├── infrastructure/                # Infrastructure Layer (框架适配)
│   ├── adapters/
│   │   ├── editors/               # 编辑器适配器
│   │   ├── repositories/          # 仓库适配器
│   │   └── gateways/              # 网关适配器
│   ├── di/                        # 依赖注入容器
│   └── config/                    # 配置
│
├── presentation/                  # Presentation Layer (UI)
│   ├── components/                # Vue 组件
│   ├── stores/                    # Pinia Store (薄代理)
│   └── composables/               # Vue Composables
│
└── shared/                        # 共享层
    ├── constants/
    ├── utils/
    └── types/
```

---

## 详细实施步骤

### Phase 1: Domain Layer (核心层)

#### 1.1 Value Objects (值对象)
| 文件 | 内容 |
|------|------|
| `core/domain/value-objects/ViewMode.ts` | WYSIWYG/SOURCE/SPLIT 枚举 |
| `core/domain/value-objects/Selection.ts` | 光标选择范围 |
| `core/domain/value-objects/CursorPosition.ts` | 光标位置 |
| `core/domain/value-objects/Heading.ts` | 标题信息 |
| `core/domain/value-objects/FileType.ts` | 文件类型 |
| `core/domain/value-objects/Markdown.ts` | Markdown 内容值对象 |

#### 1.2 Entities (实体/聚合根)
| 文件 | 内容 |
|------|------|
| `core/domain/entities/Editor.ts` | 编辑器聚合根 |
| `core/domain/entities/Document.ts` | 文档实体 |
| `core/domain/entities/Tab.ts` | 标签页聚合根 |
| `core/domain/entities/FileNode.ts` | 文件节点 |
| `core/domain/entities/Preferences.ts` | 偏好设置值对象 |
| `core/domain/entities/Search.ts` | 搜索实体 |
| `core/domain/entities/Image.ts` | 图片实体 |

#### 1.3 Domain Events (领域事件)
| 文件 | 内容 |
|------|------|
| `core/domain/events/DomainEvent.ts` | 基础接口 |
| `core/domain/events/EditorContentChanged.ts` | 内容变更 |
| `core/domain/events/EditorReady.ts` | 编辑器就绪 |
| `core/domain/events/TabCreated.ts` | 标签创建 |
| `core/domain/events/TabClosed.ts` | 标签关闭 |
| `core/domain/events/TabSwitched.ts` | 标签切换 |
| `core/domain/events/FileOpened.ts` | 文件打开 |
| `core/domain/events/FileSaved.ts` | 文件保存 |
| `core/domain/events/SearchCompleted.ts` | 搜索完成 |

#### 1.4 Ports (端口接口)
| 文件 | 内容 |
|------|------|
| `core/domain/ports/IEditorProvider.ts` | 编辑器提供者端口 |
| `core/domain/ports/ITabRepository.ts` | 标签仓库端口 |
| `core/domain/ports/IFileRepository.ts` | 文件仓库端口 |
| `core/domain/ports/ISearchRepository.ts` | 搜索仓库端口 |
| `core/domain/ports/IPreferencesRepository.ts` | 偏好仓库端口 |
| `core/domain/ports/IEventBus.ts` | 事件总线端口 |
| `core/domain/ports/IFileSystem.ts` | 文件系统端口 |
| `core/domain/ports/IIPC.ts` | IPC 端口 |
| `core/domain/ports/IStorage.ts` | 存储端口 |
| `core/domain/ports/IThemeService.ts` | 主题服务端口 |
| `core/domain/ports/IScrollService.ts` | 滚动服务端口 |
| `core/domain/ports/IImageStorage.ts` | 图片存储端口 |
| `core/domain/ports/IImageInsertStrategy.ts` | 图片插入策略端口 |

---

### Phase 2: Application Layer (应用层)

#### 2.1 Commands (写操作)
| 文件 | 内容 |
|------|------|
| `core/application/commands/editor/SetContentCommand.ts` | 设置内容 |
| `core/application/commands/editor/SetViewModeCommand.ts` | 设置视图模式 |
| `core/application/commands/editor/ToggleFocusModeCommand.ts` | 切换专注模式 |
| `core/application/commands/editor/ToggleTypewriterModeCommand.ts` | 切换打字机模式 |
| `core/application/commands/editor/ScrollToHeadingCommand.ts` | 滚动到标题 |
| `core/application/commands/tab/CreateTabCommand.ts` | 创建标签 |
| `core/application/commands/tab/CloseTabCommand.ts` | 关闭标签 |
| `core/application/commands/tab/SwitchTabCommand.ts` | 切换标签 |
| `core/application/commands/tab/UpdateTabCommand.ts` | 更新标签 |
| `core/application/commands/file/OpenFileCommand.ts` | 打开文件 |
| `core/application/commands/file/SaveFileCommand.ts` | 保存文件 |
| `core/application/commands/file/CreateFileCommand.ts` | 创建文件 |
| `core/application/commands/file/DeleteFileCommand.ts` | 删除文件 |
| `core/application/commands/file/RenameFileCommand.ts` | 重命名文件 |
| `core/application/commands/search/SearchInFileCommand.ts` | 文件内搜索 |
| `core/application/commands/search/ReplaceInFileCommand.ts` | 文件内替换 |
| `core/application/commands/preferences/UpdatePreferenceCommand.ts` | 更新偏好 |

#### 2.2 Queries (读操作)
| 文件 | 内容 |
|------|------|
| `core/application/queries/editor/GetContentQuery.ts` | 获取内容 |
| `core/application/queries/editor/GetHTMLQuery.ts` | 获取 HTML |
| `core/application/queries/editor/GetHeadingsQuery.ts` | 获取标题 |
| `core/application/queries/editor/GetSelectionQuery.ts` | 获取选区 |
| `core/application/queries/editor/IsReadyQuery.ts` | 检查就绪 |
| `core/application/queries/tab/GetActiveTabQuery.ts` | 获取活动标签 |
| `core/application/queries/tab/GetAllTabsQuery.ts` | 获取所有标签 |
| `core/application/queries/file/GetFileTreeQuery.ts` | 获取文件树 |
| `core/application/queries/search/GetSearchResultsQuery.ts` | 获取搜索结果 |
| `core/application/queries/preferences/GetPreferenceQuery.ts` | 获取偏好 |

#### 2.3 Use Cases (组合用例)
| 文件 | 内容 |
|------|------|
| `core/application/use-cases/editor/InitEditor.ts` | 初始化编辑器 |
| `core/application/use-cases/editor/SwitchViewMode.ts` | 切换视图模式 |
| `core/application/use-cases/tab/CreateTab.ts` | 创建标签用例 |
| `core/application/use-cases/tab/CloseTab.ts` | 关闭标签用例 |
| `core/application/use-cases/tab/SwitchTab.ts` | 切换标签用例 |
| `core/application/use-cases/file/OpenFile.ts` | 打开文件用例 |
| `core/application/use-cases/file/SaveFile.ts` | 保存文件用例 |
| `core/application/use-cases/search/SearchInFile.ts` | 文件内搜索用例 |
| `core/application/use-cases/search/ReplaceInFile.ts` | 文件内替换用例 |

---

### Phase 3: Infrastructure Layer (基础设施层)

#### 3.1 Editor Adapters (编辑器适配器)
| 文件 | 内容 |
|------|------|
| `infrastructure/adapters/editors/MilkdownAdapter.ts` | Milkdown/Crepe 适配器 |
| `infrastructure/adapters/editors/CodeMirrorAdapter.ts` | CodeMirror 适配器 |
| `infrastructure/adapters/editors/EditorAdapterFactory.ts` | 编辑器工厂 |

#### 3.2 Repository Adapters (仓库适配器)
| 文件 | 内容 |
|------|------|
| `infrastructure/adapters/repositories/PiniaTabRepository.ts` | Tab 仓库 |
| `infrastructure/adapters/repositories/PiniaFileRepository.ts` | 文件仓库 |
| `infrastructure/adapters/repositories/PiniaSearchRepository.ts` | 搜索仓库 |
| `infrastructure/adapters/repositories/PiniaPreferencesRepository.ts` | 偏好仓库 |

#### 3.3 Gateway Adapters (网关适配器)
| 文件 | 内容 |
|------|------|
| `infrastructure/adapters/gateways/NativeEventBus.ts` | 原生事件总线 |
| `infrastructure/adapters/gateways/ElectronFileSystem.ts` | Electron 文件系统 |
| `infrastructure/adapters/gateways/ElectronIPC.ts` | Electron IPC |
| `infrastructure/adapters/gateways/MemoryStorage.ts` | 内存存储 |
| `infrastructure/adapters/gateways/DOMThemeService.ts` | DOM 主题服务 |
| `infrastructure/adapters/gateways/DOMScrollService.ts` | DOM 滚动服务 |
| `infrastructure/adapters/gateways/FileSystemImageStorage.ts` | 文件系统图片存储 |
| `infrastructure/adapters/gateways/ClipboardImageInsertStrategy.ts` | 剪贴板图片策略 |
| `infrastructure/adapters/gateways/FileImageInsertStrategy.ts` | 文件图片策略 |
| `infrastructure/adapters/gateways/URLImageInsertStrategy.ts` | URL 图片策略 |

#### 3.4 DI Container (依赖注入)
| 文件 | 内容 |
|------|------|
| `infrastructure/di/Container.ts` | 核心容器 |
| `infrastructure/di/tokens.ts` | 注入令牌 |
| `infrastructure/di/providers.ts` | 提供者配置 |

---

### Phase 4: Presentation Layer (表现层)

#### 4.1 Stores (Pinia 状态薄代理)
| 文件 | 内容 |
|------|------|
| `presentation/stores/editor.ts` | 编辑器 Store |
| `presentation/stores/tabs.ts` | 标签 Store |
| `presentation/stores/files.ts` | 文件 Store |
| `presentation/stores/search.ts` | 搜索 Store |
| `presentation/stores/preferences.ts` | 偏好 Store |
| `presentation/stores/layout.ts` | 布局 Store |
| `presentation/stores/viewMode.ts` | 视图模式 Store |

#### 4.2 Composables (Vue 组合式函数)
| 文件 | 内容 |
|------|------|
| `presentation/composables/useEditor.ts` | 编辑器业务逻辑 |
| `presentation/composables/useTabs.ts` | 标签业务逻辑 |
| `presentation/composables/useFiles.ts` | 文件业务逻辑 |
| `presentation/composables/useSearch.ts` | 搜索业务逻辑 |
| `presentation/composables/usePreferences.ts` | 偏好业务逻辑 |
| `presentation/composables/useWritingEnhancement.ts` | 写作增强 |

#### 4.3 Components (Vue 组件)
- 保持现有组件结构，仅修改导入路径和依赖方式

---

### Phase 5: Shared Layer (共享层)

| 文件 | 内容 |
|------|------|
| `shared/constants/app.ts` | 应用常量 |
| `shared/constants/editor.ts` | 编辑器常量 |
| `shared/constants/events.ts` | 事件常量 |
| `shared/utils/date.ts` | 日期工具 |
| `shared/utils/string.ts` | 字符串工具 |
| `shared/utils/id.ts` | ID 生成 |
| `shared/types/index.ts` | 类型重导出 |

---

## 迁移策略

### 策略：绞杀者模式

1. **新旧并存**：新架构代码放在新目录，旧代码保持运行
2. **逐步切换**：一个 Use Case 一个 Use Case 迁移
3. **验证后删除**：验证无误后删除旧代码

### 优先级顺序

1. Domain Layer (无依赖，最先完成)
2. Infrastructure Adapters (依赖 Domain)
3. Application Use Cases (依赖 Domain + Infrastructure)
4. DI Container (串联所有层)
5. Presentation Layer (最后迁移 UI)

---

## 验收标准

### 架构规则检查
- [ ] Domain Layer 零外部依赖
- [ ] Application Layer 仅依赖 Domain
- [ ] Infrastructure 实现 Domain 端口
- [ ] Presentation 仅依赖 Application
- [ ] 无循环依赖

### 功能验证
- [ ] 编辑器初始化/销毁
- [ ] Markdown 读写
- [ ] 三种视图模式切换
- [ ] 标签页 CRUD
- [ ] 文件打开/保存
- [ ] 搜索/替换
- [ ] 专注/打字机模式
- [ ] 主题切换
- [ ] 图片插入

### 测试覆盖
- [ ] Domain 单元测试 100%
- [ ] Application 单元测试 100%
- [ ] Infrastructure 集成测试
- [ ] E2E 核心流程测试

---

## 文件清单统计

| 层级 | 预估文件数 | 预估行数 |
|------|------------|----------|
| Domain | 35 | ~2500 |
| Application | 40 | ~3000 |
| Infrastructure | 25 | ~3500 |
| Presentation | 20 | ~2000 |
| Shared | 10 | ~500 |
| **总计** | **130** | **~11500** |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| Milkdown API 变化 | Adapter 隔离，仅修改 Adapter |
| 迁移中功能回归 | 每个 Use Case 迁移后立即 E2E 测试 |
| 依赖注入复杂度 | 使用简单的手动 DI Container，无框架 |
| 团队不熟悉架构 | 编写架构决策记录 (ADR) |

---

## 时间估算

| 阶段 | 预估工时 |
|------|----------|
| Phase 1: Domain | 8h |
| Phase 2: Application | 12h |
| Phase 3: Infrastructure | 16h |
| Phase 4: Presentation | 8h |
| Phase 5: Shared + 清理 | 4h |
| 测试验证 | 8h |
| **总计** | **56h** |

---

## 重构实战经验总结 (Lessons Learned)

### 1. 事件系统不一致 —— 最常见的跨层 Bug
| 问题 | 根因 | 预防 |
|------|------|------|
| 事件名不匹配 (`VIEW_MODE_CHANGED` vs `VIEW_MODE_CHANGE`) | 常量定义冗余、语义重复 | 统一事件契约：共享 TypeScript 类型定义 `EventMap`，emit/on 双方共享 |
| 状态更新后未发事件 | 只想到「更新状态」，没想到「通知订阅者」 | 规定：聚合根状态变更后，必须发领域事件 |
| 载荷格式不统一 | 缺乏事件契约文档 | 定义 `interface EventPayloadMap { VIEW_MODE_CHANGE: { mode: ViewMode } }` |

### 2. Use Case 依赖注入缺失 —— 核心业务逻辑失效
| 问题 | 根因 | 预防 |
|------|------|------|
| `InitEditor` 缺少 `ITabRepository` | 重构提取 Use Case 时只注入了 Port，漏了 Repository | **检查清单**：每个 Use Case 构造函数 = 它需要的所有 Repository + Port |
| `useEditor` Facade 缺少 Port 方法 | Facade 只暴露「读」没暴露「写/订阅」 | **规则**：Facade 方法数 = Port 方法数 |

### 3. 多层调用参数丢失 —— 透传断层
| 问题 | 根因 | 预防 |
|------|------|------|
| `init` 丢失 `content` 参数 | 4 层调用 (`EditorContainer → useAppContext → useEditor → InitExecutor`) 中间层未透传 | **类型系统保护**：强制签名 `execute(container, content, tabId)`，中间层不得省略参数 |
| `editor.init` 签名不匹配 | Port 定义有 `content` 但实现未用、调用方未传 | Port 定义即契约，实现必须完整实现 |

### 4. 回调链路断裂 —— 聚合内同步失效
| 问题 | 根因 | 预防 |
|------|------|------|
| `onContentChange` 链路中断 | `InitEditor` 缺失 Repository 注入，无法同步聚合根 | **架构原则**：聚合内同步 = Use Case 直接调用 Repository.update() (同步命令) |

### 5. 事件 vs 直接回调 —— 边界不清
| 场景 | 机制 | 说明 |
|------|------|------|
| 聚合内状态同步 | Use Case → Repository.update() | 同步命令、有副作用、必须成功 |
| 跨聚合通知 | EventBus.emit() | 异步事件、无副作用、可丢失 |

---

## 工程化预防清单 (Checklist)

### 架构设计阶段
- [ ] 事件契约先行：定义 `EventMap` 共享类型，emit/on 双方共享
- [ ] Port 定义完整：每个 Port 方法都要有明确的输入输出类型
- [ ] Use Case 依赖清单：构造函数参数 = 所有需要的 Repository + Port

### 编码实现阶段
- [ ] Facade 1:1 暴露 Port 方法 (`useEditor` 方法数 = `IEditorProvider` 方法数)
- [ ] 多层调用参数强制透传：中间层不得省略/修改参数签名
- [ ] 聚合内同步用 Repository.update()，跨聚合用 EventBus.emit()

### 重构验证阶段
- [ ] **全链路手动测试**：打开文件 → 编辑 → 保存 → 切模式 → 切 Tab → 关闭
- [ ] 关键日志链路完整：`Adapter → UseCase → Repository → Store → UI`
- [ ] 事件名/载荷类型检查：emit/on 双方共享同一 TypeScript 接口

---

## 架构决策记录 (ADR) 索引

| ADR | 标题 | 状态 |
|-----|------|------|
| ADR-001 | 采用 Clean Architecture + Hexagonal Architecture | ✅ 已接受 |
| ADR-002 | 使用绞杀者模式迁移 | ✅ 已接受 |
| ADR-003 | 事件总线仅用于跨聚合通知 | ✅ 已接受 |
| ADR-004 | Use Case 必须注入完整 Repository 依赖 | ✅ 已接受 |
| ADR-005 | Facade 必须 1:1 暴露 Port 能力 | ✅ 已接受 |
| ADR-006 | 聚合内同步用 Repository 命令，跨聚合用 EventBus 事件 | ✅ 已接受 |

---

*本计划基于对现有代码库的完整分析，遵循 Clean Architecture、Hexagonal Architecture、DDD 和 SOLID 原则设计。*