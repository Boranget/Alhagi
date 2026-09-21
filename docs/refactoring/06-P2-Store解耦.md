# P2：Store 解耦 —— 提取业务逻辑到 Use Case

**阶段目标**: 将嵌入 Store 中的业务逻辑提取到 Use Case，Store 变为纯数据容器
**预计工时**: 3~4 天
**依赖**: P0 完成

---

## 一、本阶段完成的改造内容

### P2.1 提取 tabs.ts Store 中的业务逻辑

当前 `src/stores/tabs.ts`（261 行）中需要提取的业务逻辑：

| 业务逻辑 | 当前位置 | 迁移到 |
|---------|---------|--------|
| Tab 创建（UUID 生成、文件类型检测、默认值填充） | `createTab()` L59-112 | `CreateTab` Use Case |
| Tab 关闭邻居选择算法 | `removeTab()` L134-156 | `CloseTab` Use Case |
| 事件发送（TAB_CREATED, TAB_SWITCHED 等） | `createTab()` / `switchTab()` | 对应 Use Case 通过 IEventBus |
| Electron IPC 同步 | `syncOpenedFiles()` L22-28 | 新增 `IElectronSync` Gateway |

### P2.2 增强 Use Case 处理业务逻辑

`CreateTab` Use Case 改造后：

```typescript
export class CreateTab {
  constructor(
    private tabRepository: ITabRepository,
    private eventBus: IEventBus,
    private electronSync: IElectronSync
  ) {}

  async execute(options: CreateTabOptions): Promise<Tab> {
    const id = crypto.randomUUID()
    const fileType = detectFileType(options.filePath)
    const tab = Tab.create({ id, fileType, ...options })
    this.tabRepository.create(tab)
    this.eventBus.emit(AppEvents.TAB_CREATED, { tabId: id, tab: tab.toProps() })
    await this.electronSync.syncOpenedFiles()
    return tab
  }
}
```

### P2.3 新增 IElectronSync Gateway

```typescript
// src/core/domain/ports/gateways/IElectronSync.ts
export interface IElectronSync {
  syncOpenedFiles(filePaths: string[]): Promise<void>
  updateRecentFiles(filePath: string): Promise<void>
}

// src/adapters/gateways/ElectronSyncGateway.ts
// 实现：调用 window.electronAPI
```

### P2.4 提取 layout.ts Store 中的业务逻辑

| 业务逻辑 | 迁移到 |
|---------|--------|
| `toggleSidebar()` → 事件发送 | `ToggleSidebar` Use Case |
| `toggleTabBar()` → 事件发送 | `ToggleTabBar` Use Case |
| 窗口模式切换 → IPC 调用 | `SetWindowMode` Use Case |

### P2.5 提取 preferences Store 中的业务逻辑

| 业务逻辑 | 迁移到 |
|---------|--------|
| `zoomIn()` / `zoomOut()` 边界检查 | `UpdatePreference` Use Case |
| `toggleLightDark()` → 事件发送 | `ToggleTheme` Use Case |

---

## 二、本阶段不改动/保留的代码范围

- `src/core/entities/` 不动
- `src/core/domain/ports/` 仅新增 `IElectronSync`
- `src/commands/` 不动
- `src/adapters/composables/useAppContext.ts` 不动
- `src/adapters/stores/` 不动（P5 阶段处理）
- `src/infrastructure/di/Container.ts` 不动
- 所有 Vue 组件不动
- 所有 Gateway 不动（除新增 `ElectronSyncGateway`）

---

## 三、本阶段独立测试用例

| 测试类型 | 测试内容 | 验证点 |
|---------|---------|--------|
| `tabs` Store 单元测试 | 纯数据操作 | CRUD 正确，无事件发送 |
| `CreateTab` Use Case 回归 | 完整创建流程 | 业务逻辑完整，事件正常发送 |
| `CloseTab` Use Case 回归 | 邻居选择算法 | 选择逻辑正确 |
| `ElectronSyncGateway` 测试 | IPC 同步 | 文件列表正确同步 |
| `layout` Store 测试 | 纯状态切换 | 无 IPC 调用 |
| E2E 回归 | Tab 创建/关闭/切换 | 功能不受影响 |

---

## 四、阶段交付物

- [ ] `src/stores/tabs.ts` 重构为纯数据容器（≤80 行）
- [ ] `src/stores/layout.ts` 重构为纯数据容器
- [ ] `src/stores/preferences/` 各子 Store 精简
- [ ] `src/core/use-cases/tabs/CreateTab.ts` 增强
- [ ] `src/core/use-cases/tabs/CloseTab.ts` 增强
- [ ] `src/core/domain/ports/gateways/IElectronSync.ts` 新增
- [ ] `src/adapters/gateways/ElectronSyncGateway.ts` 新增
- [ ] 新增 Store 纯数据测试 ~30 个用例
- [ ] 所有测试通过

---

## 五、验证方式

```bash
# 1. TypeScript 编译
npx vue-tsc --noEmit

# 2. 单元测试全量通过
npm run test:run

# 3. 覆盖率检查
npm run test:coverage
# 期望：Store 覆盖率 >= 60%

# 4. 代码审查：确认 Store 中无事件发送、无 IPC 调用、无业务判断
grep -n "eventBus\|electronAPI\|crypto.randomUUID\|detectFileType" src/stores/
# 期望：0 匹配

# 5. E2E 回归
npm run test:e2e

# 打 tag
git tag refactor/phase-2
```
