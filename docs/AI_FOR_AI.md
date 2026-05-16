# Alhagi - AI 助手开发文档

**版本:** 1.0  
**目标读者:** AI 编程助手  
**用途:** 指导 AI 助手进行代码开发

---

## 🎯 快速导航

```
开发流程:
1. 阅读本文件 (AI_FOR_AI.md)
2. 查看开发任务清单 (TASKS.md)
3. 参考技术实现细节 (IMPLEMENTATION.md)
4. 遵循代码规范 (CODE_STYLE.md)
```

---

## 📋 核心信息

### 项目概况

- **项目:** Alhagi (顾念笔记)
- **类型:** Electron Markdown 编辑器
- **架构:** 单窗口单实例、多窗口多实例
- **状态:** 设计完成，待开发

### 技术栈

```
Frontend: Vue 3.4 + TypeScript + Pinia + Vite 5
Backend: Electron 28 + Node.js
Editor: Milkdown 7.x (@milkdown/crepe)
Styling: CSS Variables + SCSS
```

### 核心架构

```
Electron Main Process
    │
    ├── Window 1 (Renderer A)
    │   ├── Editor Instance A (单例)
    │   ├── Tab 1 {content, cursor, scroll, undoStack, redoStack}
    │   └── Tab 2 {...}
    │
    └── Window 2 (Renderer B)
        ├── Editor Instance B (单例)
        └── Tab 3 {...}
```

---

## 🚀 开发优先级

### P0 - 核心功能 (必须首先实现)

1. **项目脚手架**
   - [ ] 创建 Electron + Vue 3 + TypeScript 项目
   - [ ] 配置 Vite 构建
   - [ ] 配置 ESLint + Prettier

2. **编辑器核心**
   - [ ] 集成 Milkdown 7.x
   - [ ] 实现三种编辑模式 (WYSIWYG/Source/Split)
   - [ ] 实现打字机模式和专注模式

3. **标签页系统**
   - [ ] 实现 TabState 数据结构
   - [ ] 实现标签页切换 (保存/恢复状态)
   - [ ] 实现标签页拖拽分离/合并

4. **文件管理**
   - [ ] 实现文件打开/保存
   - [ ] 实现自动保存
   - [ ] 实现脏标记

### P1 - 重要功能

5. **侧边栏**
   - [ ] 文件树 (File Explorer)
   - [ ] 全局搜索 (Search in Files)
   - [ ] 文章大纲 (Outline)

6. **窗口管理**
   - [ ] 多窗口支持
   - [ ] 跨窗口标签页迁移 (IPC)
   - [ ] 窗口状态持久化

7. **主题系统**
   - [ ] 浅色/深色主题
   - [ ] CSS 变量管理
   - [ ] 主题切换

### P2 - 增强功能

8. **导出功能**
   - [ ] 导出 PDF
   - [ ] 导出 HTML
   - [ ] 导出 TXT

9. **设置面板**
   - [ ] 所有配置项
   - [ ] 快捷键自定义

10. **国际化**
    - [ ] 中英文切换
    - [ ] i18n 配置

---

## 📁 关键文件结构

```
src/
├── main/                      # Electron 主进程
│   ├── main.ts               # 入口
│   ├── window-manager.ts     # 窗口管理
│   ├── ipc-handlers.ts       # IPC 处理
│   └── file-service.ts       # 文件服务
│
├── renderer/                  # 渲染进程
│   ├── App.vue
│   ├── main.ts
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── EditorContainer.vue
│   │   │   ├── Toolbar.vue
│   │   │   └── StatusBar.vue
│   │   ├── Tabs/
│   │   │   ├── TabBar.vue
│   │   │   └── TabItem.vue
│   │   └── Sidebar/
│   │       ├── Sidebar.vue
│   │       ├── FileExplorer.vue
│   │       ├── SearchPanel.vue
│   │       └── Outline.vue
│   ├── stores/
│   │   ├── window.ts         # 窗口状态
│   │   ├── tabs.ts           # 标签页状态
│   │   └── preferences.ts    # 偏好设置
│   └── utils/
│       ├── editor-factory.ts  # 编辑器工厂
│       └── state-serializer.ts # 状态序列化
│
├── shared/                    # 共享类型
│   └── types.ts              # TypeScript 类型定义
│
└── preload/                   # Preload 脚本
    └── preload.ts
```

---

## 🔑 核心实现要点

### 1. 标签页状态管理

```typescript
interface TabState {
  id: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
  cursor: { from: number; to: number };
  scrollTop: number;
  viewMode: 'wysiwyg' | 'source' | 'split';
  undoStack: HistoryItem[];
  redoStack: HistoryItem[];
}
```

**关键点:**
- 每个标签页独立维护完整状态
- 切换时保存当前状态到 TabState
- 切换时从 TabState 恢复目标状态
- 历史栈必须完整迁移

### 2. 编辑器实例管理

```typescript
// 每个窗口一个编辑器实例
class EditorInstanceManager {
  private editor: Editor | null = null;
  
  async getEditor(): Promise<Editor> {
    if (!this.editor) {
      this.editor = await this.createEditor();
    }
    return this.editor;
  }
  
  async switchTab(tabState: TabState) {
    // 保存当前状态
    if (this.editor) {
      await this.saveState();
    }
    
    // 恢复目标状态
    this.editor.setMarkdown(tabState.content);
    this.editor.setSelection(tabState.cursor.from, tabState.cursor.to);
    this.editor.setScrollTop(tabState.scrollTop);
    this.editor.setUndoStack(tabState.undoStack);
    this.editor.setRedoStack(tabState.redoStack);
  }
}
```

### 3. 跨窗口迁移 (IPC)

```typescript
// Renderer: 发起迁移
async function moveTabToWindow(toWindowId: string, tabId: string) {
  const tabState = getTabState(tabId);
  const serialized = JSON.stringify(tabState);
  
  await ipcRenderer.invoke('window:moveTab', {
    fromWindowId: currentWindowId,
    toWindowId,
    tabId,
    state: serialized
  });
}

// Main Process: 处理迁移
ipcMain.handle('window:moveTab', async (event, { fromWindowId, toWindowId, tabId, state }) => {
  // 1. 从源窗口移除
  sendToWindow(fromWindowId, 'tab:remove', tabId);
  
  // 2. 在目标窗口添加
  sendToWindow(toWindowId, 'tab:add', {
    tabId,
    state: JSON.parse(state)
  });
});
```

### 4. 文件监听

```typescript
import chokidar from 'chokidar';

class FileWatcher {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  
  watch(filePath: string, callback: (content: string) => void) {
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true
    });
    
    watcher.on('change', async () => {
      const content = await fs.readFile(filePath, 'utf-8');
      callback(content);
    });
    
    this.watchers.set(filePath, watcher);
  }
}
```

---

## ⚠️ 注意事项

### 必须遵守的规则

1. **不要使用 CDN**
   - 所有依赖静态引入
   - 不使用在线资源

2. **TypeScript 严格模式**
   ```json
   {
     "strict": true,
     "noImplicitAny": true,
     "strictNullChecks": true
   }
   ```

3. **代码规范**
   - 使用 ESLint + Prettier
   - 遵循 Vue 3 Composition API 风格
   - 组件使用 `<script setup>`

4. **性能要求**
   - 启动时间 < 2 秒
   - 文件打开 < 500ms (100KB)
   - 输入延迟 < 16ms

### 禁止事项

❌ 不要使用外部 CDN 资源  
❌ 不要引入未授权的依赖  
❌ 不要跳过错误处理  
❌ 不要忽略 TypeScript 类型错误  
❌ 不要硬编码路径 (使用 path.join)

---

## 📚 参考文档

### 必读文档

1. [产品需求文档](./需求分析/产品需求文档.md) - 功能列表
2. [系统架构设计](./系统设计/系统架构设计.md) - 架构设计
3. [架构设计详解](./详细设计/架构设计详解.md) - 实现细节

### 开发时参考

1. [开发环境配置](./开发指南/开发环境配置.md) - 环境搭建
2. [代码规范](./开发指南/代码规范.md) - 编码规范 (待创建)
3. [API 文档](./API 设计/主进程 API.md) - 接口定义 (待创建)

---

## 🛠️ 开发工具

### 命令

```bash
# 开发
npm run dev

# 构建
npm run build

# 打包
npm run package

# 检查
npm run lint
npm run type-check
```

### 调试

- 主进程：VS Code Debugger (node)
- 渲染进程：Chrome DevTools (Ctrl+Shift+I)
- IPC 通信：使用日志记录

---

## 📝 任务提交格式

```markdown
## 任务：[任务名称]

### 完成内容
- [ ] 实现内容 1
- [ ] 实现内容 2

### 技术要点
- 使用的技术/库
- 关键实现逻辑

### 测试情况
- [ ] 功能测试通过
- [ ] 性能测试通过
- [ ] 无 TypeScript 错误
- [ ] ESLint 检查通过

### 相关文件
- src/xxx/xxx.ts
- src/yyy/yyy.vue
```

---

## 💡 AI 助手开发提示

### 开发顺序建议

1. **先搭建框架** - 项目结构、基础配置
2. **再实现核心** - 编辑器、标签页、文件管理
3. **然后完善** - 侧边栏、主题、设置
4. **最后优化** - 性能、错误处理、国际化

### 遇到问题时

1. 查看现有文档是否有说明
2. 参考 MarkText 等开源项目
3. 查看 Milkdown 官方文档
4. 添加日志辅助调试

### 代码生成原则

- 优先使用 TypeScript 类型
- 组件化开发
- 错误处理完善
- 代码注释清晰
- 遵循单一职责

---

## 🔄 文档更新

当实现过程中发现文档有误或需要补充时:

1. 记录实际实现与文档的差异
2. 更新相关文档
3. 在本文档中添加说明

---

**开始开发前，请先阅读 [开发任务清单](./AI_TASKS.md)**

---

**文档结束**
