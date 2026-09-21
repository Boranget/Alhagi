# P5：CQRS + Mediator —— 读写分离与统一调用入口

**阶段目标**: 实现 CQRS 读写分离，消除双层 Store，引入 Mediator 统一组件调用入口
**预计工时**: 4~5 天
**依赖**: P2, P3 完成

---

## 一、本阶段完成的改造内容

### P5.1 消除双层 Store

当前 `src/adapters/stores/tabs.ts`（132 行）是 Pinia Store 包装 Pinia Store 的冗余层。

改造方案：
- 删除 `src/adapters/stores/tabs.ts`（双层 Store 适配器）
- 让 `src/stores/tabs.ts` 直接实现 `ITabRepository` 接口
- 消除 `toTab()` / `toTabState()` 转换

改造后：

```typescript
export const useTabsStore = defineStore('tabs', (): ITabRepository => {
  // 纯数据状态（P2 已完成）
  // 直接实现 ITabRepository 接口
  const create = (tab: Tab): void => { /* 写入 Map */ }
  const getById = (id: string): Tab | undefined => { /* 直接返回 */ }
  const getAll = (): Tab[] => { /* 直接返回数组 */ }
  const update = (id: string, patch: Partial<Tab>): void => { /* 纯更新 */ }
  const remove = (id: string): void => { /* 纯删除 */ }
  return { /* ITabRepository 实现 */ }
})
```

同样处理 `search.ts`, `preferences.ts`, `fileExplorer.ts`。

### P5.2 定义 Query 接口

```typescript
// src/core/domain/ports/queries/
export interface ITabQueries {
  getById(id: string): Tab | undefined
  getAll(): Tab[]
  getActive(): Tab | undefined
  getDirty(): Tab[]
  findByPath(path: string): Tab | undefined
  getCount(): number
}

export interface IPreferenceQueries {
  get(key: string): unknown
  getAll(): PreferencesProps
}

export interface ISearchQueries {
  getQuery(): string
  getResults(): SearchResult[]
}
```

### P5.3 定义 IMediator 接口

```typescript
// src/core/domain/ports/IMediator.ts
export interface IMediator {
  send<T>(command: Command<T>): Promise<T>
  query<T>(query: Query<T>): T
}
```

### P5.4 实现 AppMediator

```typescript
// src/adapters/mediator/AppMediator.ts
export class AppMediator implements IMediator {
  private commandHandlers = new Map<string, ICommandHandler>()
  private queryHandlers = new Map<string, IQueryHandler>()

  registerCommand<T>(name: string, handler: ICommandHandler<T>): void { ... }
  registerQuery<T>(name: string, handler: IQueryHandler<T>): void { ... }

  async send<T>(command: Command<T>): Promise<T> {
    const handler = this.commandHandlers.get(command.type)
    if (!handler) throw new Error(`No handler for command: ${command.type}`)
    return handler.execute(command.payload)
  }

  query<T>(query: Query<T>): T {
    const handler = this.queryHandlers.get(query.type)
    if (!handler) throw new Error(`No handler for query: ${query.type}`)
    return handler.execute(query.payload)
  }
}
```

### P5.5 注册 CQRS Handler

```typescript
// 写操作
export class CreateTabCommandHandler implements ICommandHandler<Tab> {
  constructor(private createTabUseCase: CreateTab) {}
  async execute(payload: CreateTabOptions): Promise<Tab> {
    return this.createTabUseCase.execute(payload)
  }
}

// 读操作
export class GetTabsQueryHandler implements IQueryHandler<Tab[]> {
  constructor(private tabRepository: ITabRepository) {}
  execute(): Tab[] {
    return this.tabRepository.getAll()
  }
}
```

---

## 二、本阶段不改动/保留的代码范围

- `src/core/entities/` 不动
- `src/core/use-cases/` 不动
- `src/core/domain/ports/` 仅新增 Query 和 Mediator 接口
- `src/commands/` 不动（P4 已完成）
- `src/infrastructure/di/Container.ts` 不动（P7 处理）
- 所有 Vue 组件不动（P6 处理）
- 所有 Gateway 不动

---

## 三、本阶段独立测试用例

| 测试类型 | 测试内容 | 验证点 |
|---------|---------|--------|
| `AppMediator` 单元测试 | Command/Query 路由 | 正确分发到 Handler |
| Command Handler 测试 | 每个写操作 | 通过 Mediator 执行 |
| Query Handler 测试 | 每个读操作 | 直接从 Repository 读取 |
| Store 回归 | 纯数据操作 | 无双层包装 |
| E2E 回归 | 核心流程 | 功能不受影响 |

---

## 四、阶段交付物

- [ ] 删除 `src/adapters/stores/tabs.ts` 等 4 个双层 Store 文件
- [ ] `src/stores/*.ts` 直接实现 Repository 接口
- [ ] `src/core/domain/ports/queries/` 目录，含 Query 接口
- [ ] `src/core/domain/ports/IMediator.ts` 接口
- [ ] `src/adapters/mediator/AppMediator.ts` 实现
- [ ] `src/adapters/mediator/handlers/` 目录，含 Command/Query Handler
- [ ] 新增 Mediator 测试 ~15 个用例
- [ ] 所有测试通过

---

## 五、验证方式

```bash
# 1. TypeScript 编译
npx vue-tsc --noEmit

# 2. 单元测试全量通过
npm run test:run

# 3. 代码审查：确认双层 Store 文件已删除
ls src/adapters/stores/
# 期望：无 tabs.ts, search.ts, preferences.ts, fileExplorer.ts

# 4. 代码审查：确认 Store 直接实现 Repository 接口
grep -n "ITabRepository" src/stores/tabs.ts
# 期望：有 ITabRepository 实现

# 5. E2E 回归
npm run test:e2e

# 打 tag
git tag refactor/phase-5
```
