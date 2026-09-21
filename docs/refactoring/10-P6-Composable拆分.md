# P6：Composable 拆分 —— 消除 God Object

**阶段目标**: 将 `useAppContext()`（216 行，80+ 属性）拆分为按领域划分的 Facade
**预计工时**: 2~3 天
**依赖**: P5 完成

---

## 一、本阶段完成的改造内容

### P6.1 拆分 useAppContext 为领域 Facade

| 新 Facade | 文件 | 暴露属性 | 消费者 |
|-----------|------|---------|--------|
| `useTabContext` | `src/adapters/composables/useTabContext.ts` | tabs, activeTab, createTab, closeTab, switchTab | TabBar, StatusBar, EditorContainer |
| `useFileContext` | `src/adapters/composables/useFileContext.ts` | openFile, saveFile, createFile, deleteFile | FileExplorer, MenuBar |
| `useEditorContext` | `src/adapters/composables/useEditorContext.ts` | editor, viewMode, initEditor, switchTab | EditorContainer, CodeMirrorEditor |
| `useSearchContext` | `src/adapters/composables/useSearchContext.ts` | search, findNext, findPrev, replace | SearchBar, EnhancedSidebar |
| `useLayoutContext` | `src/adapters/composables/useLayoutContext.ts` | layout, toggleSidebar, toggleTabBar | StatusBar, MenuBar |

### P6.2 每个 Facade 的实现模式

```typescript
// src/adapters/composables/useTabContext.ts
export function useTabContext() {
  const mediator = useMediator()
  const tabQueries = useTabQueries()

  return {
    // 查询（直接读 Repository）
    tabs: tabQueries.getAll(),
    activeTab: tabQueries.getActive(),
    tabCount: computed(() => tabQueries.getCount()),
    dirtyTabs: tabQueries.getDirty(),

    // 命令（通过 Mediator）
    createTab: (options: CreateTabOptions) => mediator.send(new CreateTabCommand(options)),
    closeTab: (id: string) => mediator.send(new CloseTabCommand({ tabId: id })),
    switchTab: (id: string) => mediator.send(new SwitchTabCommand({ tabId: id })),
    updateTab: (id: string, patch: Partial<Tab>) => mediator.send(new UpdateTabCommand({ tabId: id, patch })),
  }
}
```

### P6.3 更新所有消费者

当前 3 个 `useAppContext` 消费者的替换：

| 文件 | 当前 | 替换为 |
|------|------|--------|
| `src/App.vue` | `const { tabs, layout, prefs } = useAppContext()` | `useTabContext()` + `useLayoutContext()` |
| `src/components/StatusBar/StatusBar.vue` | `const { tabs, prefs, layout, viewMode } = useAppContext()` | `useTabContext()` + `useLayoutContext()` + `useEditorContext()` |
| `src/components/Editor/EditorContainer.vue` | `const { tabs, editor, viewMode } = useAppContext()` | `useTabContext()` + `useEditorContext()` |

### P6.4 删除 useAppContext

拆分完成后删除 `src/adapters/composables/useAppContext.ts`。

---

## 二、本阶段不改动/保留的代码范围

- `src/core/` 核心层不动
- `src/stores/` 不动
- `src/commands/` 不动
- `src/adapters/mediator/` 不动
- `src/adapters/gateways/` 不动
- `src/infrastructure/di/Container.ts` 不动
- `src/composables/` UI 组合函数不动
- 所有 Vue 组件模板不动（只改 script 部分的 import）

---

## 三、本阶段独立测试用例

| 测试类型 | 测试内容 | 验证点 |
|---------|---------|--------|
| `useTabContext` 测试 | 查询和命令 | 正确代理到 Repository 和 Mediator |
| `useFileContext` 测试 | 文件操作 | 正确代理 |
| `useEditorContext` 测试 | 编辑器操作 | 正确代理 |
| `useSearchContext` 测试 | 搜索操作 | 正确代理 |
| `useLayoutContext` 测试 | 布局操作 | 正确代理 |
| E2E 回归 | 全部 UI 交互 | 功能不受影响 |

---

## 四、阶段交付物

- [ ] `src/adapters/composables/useTabContext.ts` 新增
- [ ] `src/adapters/composables/useFileContext.ts` 新增
- [ ] `src/adapters/composables/useEditorContext.ts` 新增
- [ ] `src/adapters/composables/useSearchContext.ts` 新增
- [ ] `src/adapters/composables/useLayoutContext.ts` 新增
- [ ] `src/adapters/composables/useAppContext.ts` 删除
- [ ] 3 个消费者文件更新 import
- [ ] 新增 Facade 测试 ~10 个用例
- [ ] 所有测试通过

---

## 五、验证方式

```bash
# 1. TypeScript 编译
npx vue-tsc --noEmit

# 2. 单元测试全量通过
npm run test:run

# 3. 代码审查：确认 useAppContext 已删除
ls src/adapters/composables/useAppContext.ts
# 期望：文件不存在

# 4. 代码审查：确认无文件引用 useAppContext
grep -rn "useAppContext" src/
# 期望：0 匹配

# 5. E2E 回归
npm run test:e2e

# 打 tag
git tag refactor/phase-6
```
