# 顾念笔记 - 架构审查报告

**审查日期**: 2026-05-16
**审查范围**: P0核心功能实现

---

## 🚨 严重问题

### 1. 编辑器实例管理混乱 ⚠️
**问题**:
- `EditorContainer.vue` 和 `useEditor.ts` 都在管理 Milkdown 编辑器实例
- 重复的编辑器创建/销毁逻辑
- `window.editorInstance` 的设置位置不一致
- 没有统一的编辑器实例生命周期管理

**影响**:
- 标签页切换时可能出现编辑器状态丢失
- 内存泄漏风险
- 难以维护和扩展

---

### 2. 标签页切换逻辑不完整 ⚠️
**问题**:
- `tabsStore.switchTab()` 只更新了激活标记，没有触发编辑器状态同步
- `useEditor.switchToTab()` 定义了但没有被使用
- `EditorContainer.watch(activeTab)` 实现了部分逻辑，但不完整
- **关键**: 切换标签时没有保存当前标签页的完整状态（光标、滚动位置等）

**设计文档要求**:
```typescript
// 设计文档要求的完整流程
1. 保存当前标签页的编辑器状态到 TabState
2. 从目标 TabState 恢复状态到编辑器
3. 更新激活标记
```

**当前实际实现**:
- 只更新了激活标记
- 编辑器内容同步了，但状态恢复不完整

---

### 3. 缺少统一的窗口状态管理 ✖️
**问题**:
- 设计文档中的 `WindowLocalState` 没有实现
- 设计文档中的 `GlobalState` 没有实现
- 没有窗口ID管理
- 没有多窗口支持的基础架构

**影响**:
- 无法实现标签页跨窗口拖拽（P1功能）
- 无法正确管理多个窗口的状态

---

### 4. 事件架构不统一 ✖️
**问题**:
- 没有统一的事件总线
- 组件间通信分散在各组件内部
- Electron IPC 与应用内部事件混合使用

---

### 5. Milkdown 集成问题 ⚠️
**问题**:
- 使用 `root.innerText` 来设置内容（错误！）
- 没有正确使用 Milkdown 的编辑状态管理
- 历史栈没有正确同步到 TabState
- 光标/选区位置没有正确获取和恢复

---

## 📊 问题严重度评估

| 问题 | 严重度 | 紧急度 | 影响范围 |
|------|--------|--------|----------|
| 编辑器实例管理混乱 | 🔴 高 | 🔴 高 | 核心功能 |
| 标签页切换逻辑不完整 | 🔴 高 | 🔴 高 | 核心功能 |
| 缺少窗口状态管理 | 🟡 中 | 🟡 中 | P1功能 |
| 事件架构不统一 | 🟡 中 | 🟡 低 | 架构质量 |
| Milkdown集成问题 | 🔴 高 | 🔴 高 | 核心功能 |

---

## ✅ 做得好的地方

1. **TypeScript 类型完整** - 大部分类型定义正确
2. **Pinia Store 结构清晰** - tabsStore 基础结构合理
3. **组件分层合理** - TabBar/Sidebar/StatusBar 分离正确
4. **样式系统完整** - CSS变量和主题系统设计良好
5. **Electron IPC 基础架构正确** - 安全的 IPC 通道设计

---

## 🔧 重构计划

### 第一阶段：编辑器实例管理统一
1. 创建 `EditorInstanceManager` 类（参考设计文档）
2. 移除 `useEditor.ts`，把逻辑整合到 `EditorContainer.vue`
3. 统一编辑器实例生命周期管理

### 第二阶段：完善标签页状态管理
1. 实现完整的状态保存/恢复逻辑
2. 确保切换标签时状态不会丢失
3. 正确同步 Milkdown 的历史栈

### 第三阶段：窗口状态管理（基础）
1. 创建 `windowStore`
2. 实现窗口ID管理
3. 为未来多窗口支持打基础

### 第四阶段：事件总线（可选，当前可跳过）
1. 创建简单的事件总线
2. 统一组件间通信

---

## 📝 关键实现细节

### 正确的标签页切换流程
```typescript
// 1. 保存当前标签页状态（如果有激活的标签）
if (windowState.activeTabId && windowState.editorInstance) {
  const currentTab = windowState.tabs.get(windowState.activeTabId)
  if (currentTab) {
    currentTab.content = windowState.editorInstance.getMarkdown()
    currentTab.cursor = windowState.editorInstance.getSelection()
    currentTab.scrollTop = windowState.editorInstance.getScrollTop()
    currentTab.undoStack = windowState.editorInstance.getUndoStack()
    currentTab.redoStack = windowState.editorInstance.getRedoStack()
    currentTab.lastModified = Date.now()
  }
}

// 2. 设置新的激活标签
windowState.activeTabId = tabId
windowState.tabs.forEach(t => t.active = t.id === tabId)

// 3. 恢复目标标签页状态
const targetTab = windowState.tabs.get(tabId)
if (targetTab && windowState.editorInstance) {
  windowState.editorInstance.setMarkdown(targetTab.content)
  windowState.editorInstance.setSelection(targetTab.cursor.from, targetTab.cursor.to)
  windowState.editorInstance.setScrollTop(targetTab.scrollTop)
  windowState.editorInstance.setUndoStack(targetTab.undoStack)
  windowState.editorInstance.setRedoStack(targetTab.redoStack)
}
```

---

## 🎯 重构优先级

### P0 - 必须立即修复
1. 统一编辑器实例管理
2. 修复标签页切换时的状态保存/恢复
3. 修复 Milkdown 集成问题

### P1 - 建议尽快修复
1. 实现窗口状态管理基础
2. 统一事件通信

---

**报告结束**
