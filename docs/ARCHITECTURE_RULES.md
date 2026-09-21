# Architecture Rules

**文档版本**: v1.0
**编制日期**: 2026-09-20

---

## 一、分层架构

```
UI (Vue Components / Composables)
    ↓ 调用
Adapters (Gateways / Stores / Composables)
    ↓ 实现
Core (Use Cases / Entities / Ports)
```

### 规则

| # | 规则 | 说明 |
|---|------|------|
| A1 | **Core 不依赖 Adapters 或 UI** | `src/core/` 不得 import `src/adapters/`、`src/stores/`、`src/composables/`、`src/services/` 中的任何内容 |
| A2 | **Ports 定义在 Core** | 所有 Port 接口 (`I*`) 定义在 `src/core/domain/ports/` |
| A3 | **Gateway 实现 Port** | Gateway 类位于 `src/adapters/gateways/`，实现 `src/core/domain/ports/` 中的接口 |
| A4 | **Use Case 通过 Port 交互** | Use Case 只依赖 Port 接口，不直接引用具体 Gateway 实现 |
| A5 | **Composition Root 在 Infrastructure** | DI 容器配置位于 `src/infrastructure/di/Container.ts` |

---

## 二、依赖注入 (DI)

### 规则

| # | 规则 | 说明 |
|---|------|------|
| D1 | **所有绑定使用 `inSingletonScope()`** | 防止运行时重复创建实例 |
| D2 | **Gateway 类优先 `toDynamicValue` + `inSingletonScope()`** | 避免 `@injectable()` 装饰器与 `useDefineForClassFields` 冲突 |
| D3 | **Use Case 通过 DI 容器获取依赖** | 不在 Use Case 构造函数中直接实例化依赖 |
| D4 | **测试中不使用 DI 容器** | 测试直接 mock Port 接口并传入 Use Case 构造函数 |

---

## 三、Store 规范

### 规则

| # | 规则 | 说明 |
|---|------|------|
| S1 | **Store 只管理 UI 状态** | 不在 Store 中编写业务逻辑，业务逻辑移到 Use Case |
| S2 | **禁止直接导入 `eventBus`** | 通过 `IEventBus` Port 访问事件总线 |
| S3 | **Store 不直接 import 其他 Store** | 通过 Use Case 或 Composable 编排跨 Store 操作 |
| S4 | **Store 操作通过 Use Case** | UI 组件 → Use Case → Store（单向数据流） |

---

## 四、事件系统

### 规则

| # | 规则 | 说明 |
|---|------|------|
| E1 | **统一使用 `IEventBus`** | 不使用 `CustomEvent`、`window.dispatchEvent`、直接 `eventBus.emit()` |
| E2 | **事件名使用 `AppEvents` 枚举** | 不硬编码事件名字符串 |
| E3 | **事件载荷定义在 `AppEventPayloads`** | 所有事件类型在 `src/shared/types` 中集中定义 |

---

## 五、文件组织

### 规则

| # | 规则 | 说明 |
|---|------|------|
| F1 | **Use Case 文件 ≤ 50 行** | 超过则拆分为更小的 Use Case |
| F2 | **每个 Use Case 一个文件** | 单一职责，一个文件一个行为 |
| F3 | **测试文件紧邻源文件** | `__tests__/` 目录位于被测模块同级 |
| F4 | **Gateway 实现位于 `src/adapters/gateways/`** | 不放在 `src/services/` 或 `src/core/` |

---

## 六、命名约定

### 规则

| # | 规则 | 示例 |
|---|------|------|
| N1 | **Port 接口以 `I` 开头** | `IEditorProvider`, `IEventBus` |
| N2 | **Use Case 使用动词 + 名词** | `CreateTab`, `SaveFile`, `ExecuteEditorCommand` |
| N3 | **Gateway 使用 `名词 + Gateway`** | `FileSystemGateway`, `EventBusGateway` |
| N4 | **Store 使用 `名词 + Store`（或省略 Store）** | `useTabsStore`, `useLayoutStore` |

---

## 七、测试规范

### 规则

| # | 规则 | 说明 |
|---|------|------|
| T1 | **Use Case 测试覆盖所有分支** | 包括成功、失败、边界条件 |
| T2 | **Store 测试验证状态变更** | 使用 `setActivePinia(createPinia())` 隔离 |
| T3 | **Gateway 测试验证委托** | 验证 Gateway 正确调用底层服务 |
| T4 | **测试中 mock Port 接口** | 不 mock 具体实现类 |

---

## 八、ESLint 规则

以下规则已在 `.eslintrc.cjs` 中配置（`warn` 级别）：

```javascript
'no-restricted-imports': ['warn', {
  paths: [{
    name: '@/events/eventBus',
    message: '请通过 EventBusGateway 使用事件总线，不要直接导入 eventBus'
  }],
  patterns: [
    { group: ['@/stores/tabs'], message: '请通过 ITabRepository 使用 Tabs 数据' },
    { group: ['@/stores/preferences'], message: '请通过 IPreferencesRepository 使用偏好数据' },
    { group: ['@/stores/search'], message: '请通过 ISearchRepository 使用搜索数据' },
    { group: ['@/stores/editor'], message: '请通过 IEditorProvider 使用编辑器数据' },
  ]
}]
```

> **注意**: Infrastructure 层 (`src/infrastructure/di/Container.ts`, `src/adapters/stores/`) 例外，允许直接导入 Store 作为 Port 实现。
