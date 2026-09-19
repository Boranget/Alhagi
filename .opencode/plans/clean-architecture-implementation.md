# Alhagi Clean Architecture 实施计划

## 概览

将现有架构迁移到标准的 Clean Architecture，解决所有架构债务（P0-P2 问题）。

---

## 目标架构分层

```
src/
├── core/                          # Domain Layer (纯业务逻辑，零框架依赖)
│   ├── domain/
│   │   ├── ports/                 # 接口端口（ITabRepository, IFileSystem 等）
│   │   └── entities/              # 聚合根实体
│   ├── use-cases/                 # 业务用例（已有，保持）
│   │   ├── editor/
│   │   ├── tabs/
│   │   ├── file/
│   │   ├── search/
│   │   └── preferences/
│   └── shared/                    # 共享类型和常量
│
├── infrastructure/                # Infrastructure Layer (框架适配)
│   ├── adapters/
│   │   ├── editors/               # 编辑器适配器（MilkdownAdapter）
│   │   ├── gateways/              # 网关适配器（EventBus, FileSystem 等）
│   │   └── repositories/          # 仓库适配器（TabRepository 等）
│   └── di/                        # 依赖注入容器
│
├── adapters/                      # Vue 适配层
│   ├── composables/               # Vue Composables（useEditor, useAppContext 等）
│   └── stores/                    # Pinia Store（薄代理）
│
└── shared/                        # 共享层
    ├── types/
    └── utils/
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

### Phase 2: 补齐缺失的 Ports 和 Adapters

> **目标：在现有目录结构上补齐缺失的接口和实现，不新建 `core/application/` 目录。**

#### 2.1 补齐 Domain Ports（在 `core/domain/ports/`）

| 文件 | 内容 | 状态 |
|------|------|------|
| `IEditorProvider.ts` | 编辑器提供者接口 | ✅ 已有 |
| `ITabRepository.ts` | 标签仓库接口 | ⚠️ 需补齐 |
| `IFileSystem.ts` | 文件系统接口 | ⚠️ 需补齐 |
| `IEventBus.ts` | 事件总线接口 | ⚠️ 需补齐 |
| `IPreferencesRepository.ts` | 偏好仓库接口 | ⚠️ 需补齐 |
| `IScrollService.ts` | 滚动服务接口 | ⚠️ 需补齐 |
| `IViewModeGateway.ts` | 视图模式网关接口 | ⚠️ 需补齐 |

#### 2.2 补齐 Infrastructure Adapters（在 `infrastructure/adapters/`）

| 文件 | 内容 | 状态 |
|------|------|------|
| `editors/MilkdownAdapter.ts` | Milkdown/Crepe 适配器 | ✅ 已有 |
| `repositories/PiniaTabRepository.ts` | Tab 仓库适配器 | ⚠️ 需补齐 |
| `gateways/EventBusGateway.ts` | EventBus 适配器 | ⚠️ 需补齐 |
| `gateways/FileSystemGateway.ts` | FileSystem 适配器 | ⚠️ 需补齐 |
| `gateways/PreferencesRepository.ts` | Preferences 适配器 | ⚠️ 需补齐 |
| `gateways/ScrollServiceGateway.ts` | Scroll 适配器 | ✅ 已有 |
| `gateways/ViewModeGateway.ts` | ViewMode 适配器 | ✅ 已有 |

#### 2.3 替换 Command Handlers 的直接 Store 调用

> **目标：让 `commands/handlers/index.ts` 调 Use Cases 而非直接调 Store。**

| Handler | 当前调用 | 改为调用 |
|---------|----------|----------|
| `file.open` | `useAppContext().file.openFile()` | `OpenFile.execute()` |
| `file.save` | `useAppContext().editor.save()` | `SaveFile.execute()` |
| `view.toggleTypewriterMode` | `useWritingEnhancement().toggleTypewriterMode()` | `ToggleTypewriterMode.applyState()` |
| `view.toggleFocusMode` | `useWritingEnhancement().toggleFocusMode()` | `ToggleFocusMode.applyState()` |
| `paragraph.*` | 直接调 `editorManager.commands` | 保持（纯 UI 操作，无需 Use Case） |

---

## 迁移策略

### 策略：原地迁移（禁止遗留旧架构）

> **核心原则：每完成一步，旧代码必须被替换，不允许新旧并存。**

1. **补齐缺失的 Port 接口**：在 `core/domain/ports/` 补齐 ITabRepository、IFileSystem、IEventBus 等
2. **补齐缺失的 Adapter 实现**：在 `infrastructure/adapters/` 补齐 TabRepositoryAdapter、FileSystemAdapter 等
3. **替换 Command Handlers 的直接 Store 调用**：让 handlers 调 Use Cases 而非 Store
4. **清理 Dead Code**：删除不再使用的 Store 方法、旧目录

### 优先级顺序

1. Domain Layer (补齐缺失的 Ports)
2. Infrastructure Adapters (补齐缺失的 Adapters)
3. Command Handlers 迁移 (调 Use Cases 而非 Store)
4. 清理 Dead Code (删除 stub 方法、旧目录)

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

| 层级 | 预估文件数 | 预估行数 | 说明 |
|------|------------|----------|------|
| Domain (ports) | 7 | ~200 | 补齐缺失的 Port 接口 |
| Infrastructure (adapters) | 5 | ~400 | 补齐缺失的 Adapter 实现 |
| Command Handlers 改造 | 1 | ~100 | 替换直接 Store 调用 |
| 清理 Dead Code | -20 | ~-500 | 删除 stub 方法、旧目录 |
| **净增** | **-7** | **~200** | |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| Milkdown API 变化 | Adapter 隔离，仅修改 Adapter |
| 迁移中功能回归 | 每个 Use Case 迁移后立即 E2E 测试 |
| 依赖注入复杂度 | 使用简单的手动 DI Container，无框架 |
| 团队不熟悉架构 | 编写架构决策记录 (ADR) |
| 遗留旧架构代码 | **禁止新旧并存，原地迁移** |

---

## 时间估算

| 阶段 | 预估工时 |
|------|----------|
| Phase 2: 补齐 Ports + Adapters | 4h |
| Phase 2: Command Handlers 改造 | 2h |
| Phase 2: 清理 Dead Code | 2h |
| 测试验证 | 4h |
| **总计** | **12h** |

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

### 6. 绞杀者模式导致遗留代码 —— 最大的技术债
| 问题 | 根因 | 预防 |
|------|------|------|
| 新旧目录并存，旧代码永远不删 | 绞杀者模式鼓励「先建新的，再删旧的」，但实际 never gets deleted | **规则：禁止新旧并存，原地迁移** |
| 三套代码做同一件事 | 新目录 + 旧目录 + command handlers 各自实现 | **规则：每完成一步，旧代码必须被替换** |

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
| ADR-002 | 原地迁移，禁止新旧并存 | ✅ 已接受 |
| ADR-003 | 事件总线仅用于跨聚合通知 | ✅ 已接受 |
| ADR-004 | Use Case 必须注入完整 Repository 依赖 | ✅ 已接受 |
| ADR-005 | Facade 必须 1:1 暴露 Port 能力 | ✅ 已接受 |
| ADR-006 | 聚合内同步用 Repository 命令，跨聚合用 EventBus 事件 | ✅ 已接受 |

---

*本计划基于对现有代码库的完整分析，遵循 Clean Architecture、Hexagonal Architecture、DDD 和 SOLID 原则设计。*