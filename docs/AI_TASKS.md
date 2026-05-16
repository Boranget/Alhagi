# AI 助手开发任务清单

**版本:** 1.0  
**用途:** AI 助手开发任务列表和进度跟踪

---

## 📊 任务总览

| 阶段 | 任务数 | 完成数 | 进度 |
|------|--------|--------|------|
| P0 - 核心功能 | 12 | 0 | 0% |
| P1 - 重要功能 | 15 | 0 | 0% |
| P2 - 增强功能 | 10 | 0 | 0% |
| **总计** | **37** | **0** | **0%** |

---

## 🔴 P0 - 核心功能 (必须首先完成)

### 任务 1: 项目初始化

**优先级:** P0  
**预计时间:** 2 小时  
**难度:** ⭐⭐

**任务描述:**
创建 Electron + Vue 3 + TypeScript 项目基础结构

**实现细节:**

```bash
# 1. 创建 Vite + Vue 3 + TypeScript 项目
npm create vite@latest . -- --template vue-ts

# 2. 安装 Electron
npm install --save-dev electron electron-builder

# 3. 安装 Milkdown
npm install @milkdown/crepe @milkdown/preset-commonmark @milkdown/preset-gfm

# 4. 安装 Pinia
npm install pinia

# 5. 安装开发工具
npm install --save-dev @types/node eslint prettier
```

**目录结构:**

```
src/
├── main/           # Electron 主进程
├── renderer/       # Vue 3 渲染进程
├── preload/        # Preload 脚本
└── shared/         # 共享类型
```

**配置文件:**
- vite.config.ts (配置 Electron 和 Vue)
- tsconfig.json (TypeScript 配置)
- .eslintrc (ESLint 配置)
- electron-builder.yml (打包配置)

**验收标准:**
- [ ] 项目可以运行 (npm run dev)
- [ ] TypeScript 无错误
- [ ] ESLint 检查通过
- [ ] Electron 窗口正常显示

---

### 任务 2: Milkdown 编辑器集成

**优先级:** P0  
**预计时间:** 3 小时  
**难度:** ⭐⭐⭐

**任务描述:**
集成 Milkdown 编辑器，实现基础编辑功能

**实现细节:**

```typescript
// src/renderer/utils/editor-factory.ts
import { Editor } from '@milkdown/core';
import { crepe } from '@milkdown/crepe';

export function createEditor(root: HTMLElement): Editor {
  const editor = crepe({
    root,
    features: {
      image: { upload: false },
      table: { enabled: true },
      math: { enabled: true }
    }
  });
  
  return editor;
}
```

**组件:**
- EditorContainer.vue (编辑器容器)

**验收标准:**
- [ ] 编辑器正常渲染
- [ ] 可以输入 Markdown
- [ ] 实时预览正常
- [ ] 支持 GFM 语法

---

### 任务 3: 三种编辑模式

**优先级:** P0  
**预计时间:** 4 小时  
**难度:** ⭐⭐⭐

**任务描述:**
实现 WYSIWYG、源码、分屏预览三种模式

**实现细节:**

```vue
<!-- EditorContainer.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';

type ViewMode = 'wysiwyg' | 'source' | 'split';

const viewMode = ref<ViewMode>('wysiwyg');
const markdownContent = ref('');

const switchMode = (mode: ViewMode) => {
  viewMode.value = mode;
};
</script>

<template>
  <div class="editor-container">
    <!-- WYSIWYG 模式 -->
    <div v-show="viewMode === 'wysiwyg'" id="editor-root" />
    
    <!-- 源码模式 -->
    <textarea 
      v-show="viewMode === 'source'"
      v-model="markdownContent"
      class="source-editor"
    />
    
    <!-- 分屏模式 -->
    <div v-show="viewMode === 'split'" class="split-view">
      <textarea v-model="markdownContent" class="source-part" />
      <div id="preview-root" class="preview-part" />
    </div>
  </div>
</template>
```

**验收标准:**
- [ ] 三种模式可以切换
- [ ] 内容同步
- [ ] 滚动同步 (分屏模式)
- [ ] 切换时保持光标位置

---

### 任务 4: 标签页数据结构

**优先级:** P0  
**预计时间:** 2 小时  
**难度:** ⭐⭐

**任务描述:**
实现标签页状态管理的数据结构

**实现细节:**

```typescript
// src/shared/types.ts
export interface TabState {
  id: string;              // UUID
  filePath: string | null; // 文件路径
  content: string;         // Markdown 内容
  isDirty: boolean;        // 脏标记
  title: string;           // 标签页标题
  active: boolean;         // 是否激活
  
  // 编辑器状态
  cursor: {
    from: number;
    to: number;
  };
  scrollTop: number;
  viewMode: 'wysiwyg' | 'source' | 'split';
  
  // 历史栈
  undoStack: HistoryItem[];
  redoStack: HistoryItem[];
  
  // 元数据
  createdAt: number;
  lastModified: number;
  lastSaved: number | null;
}

export interface HistoryItem {
  type: 'insert' | 'delete' | 'replace';
  from: number;
  to: number;
  content: string;
  timestamp: number;
}

export interface WindowState {
  windowId: string;
  tabs: Map<string, TabState>;
  activeTabId: string | null;
  tabOrder: string[];
}
```

**验收标准:**
- [ ] 类型定义完整
- [ ] TypeScript 编译通过
- [ ] 包含所有必要字段

---

### 任务 5: Pinia Store - 标签页管理

**优先级:** P0  
**预计时间:** 4 小时  
**难度:** ⭐⭐⭐

**任务描述:**
使用 Pinia 实现标签页状态管理

**实现细节:**

```typescript
// src/renderer/stores/tabs.ts
import { defineStore } from 'pinia';
import type { TabState } from '../../shared/types';

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabs: new Map<string, TabState>(),
    activeTabId: null as string | null,
    tabOrder: [] as string[]
  }),
  
  getters: {
    activeTab: (state) => {
      if (!state.activeTabId) return null;
      return state.tabs.get(state.activeTabId) || null;
    },
    
    dirtyTabs: (state) => {
      return Array.from(state.tabs.values()).filter(tab => tab.isDirty);
    }
  },
  
  actions: {
    addTab(tab: TabState) {
      this.tabs.set(tab.id, tab);
      this.tabOrder.push(tab.id);
    },
    
    removeTab(tabId: string) {
      this.tabs.delete(tabId);
      this.tabOrder = this.tabOrder.filter(id => id !== tabId);
      
      // 如果删除的是当前标签，切换到相邻标签
      if (this.activeTabId === tabId && this.tabOrder.length > 0) {
        this.activeTabId = this.tabOrder[this.tabOrder.length - 1];
      }
    },
    
    switchTab(tabId: string) {
      // 保存当前标签页状态
      if (this.activeTabId) {
        this.saveCurrentTabState();
      }
      
      // 切换到目标标签
      this.activeTabId = tabId;
      
      // 恢复目标标签页状态
      this.restoreTabState(tabId);
    },
    
    saveCurrentTabState() {
      // 从编辑器保存状态到 TabState
      const tab = this.activeTab;
      if (tab) {
        tab.content = window.editor.getMarkdown();
        tab.cursor = window.editor.getSelection();
        tab.scrollTop = window.editor.getScrollTop();
        tab.undoStack = window.editor.getUndoStack();
        tab.redoStack = window.editor.getRedoStack();
      }
    },
    
    restoreTabState(tabId: string) {
      // 从 TabState 恢复状态到编辑器
      const tab = this.tabs.get(tabId);
      if (tab && window.editor) {
        window.editor.setMarkdown(tab.content);
        window.editor.setSelection(tab.cursor.from, tab.cursor.to);
        window.editor.setScrollTop(tab.scrollTop);
        window.editor.setUndoStack(tab.undoStack);
        window.editor.setRedoStack(tab.redoStack);
      }
    },
    
    updateTab(tabId: string, updates: Partial<TabState>) {
      const tab = this.tabs.get(tabId);
      if (tab) {
        Object.assign(tab, updates);
      }
    }
  }
});
```

**验收标准:**
- [ ] 可以添加/删除标签页
- [ ] 标签页切换正常
- [ ] 状态保存/恢复正确
- [ ] 脏标记正常

---

### 任务 6: 标签页 UI 组件

**优先级:** P0  
**预计时间:** 3 小时  
**难度:** ⭐⭐

**任务描述:**
实现标签页栏 UI 组件

**组件:**
- TabBar.vue (标签栏)
- TabItem.vue (单个标签)

**实现细节:**

```vue
<!-- TabBar.vue -->
<script setup lang="ts">
import { useTabsStore } from '@/stores/tabs';
import TabItem from './TabItem.vue';

const tabsStore = useTabsStore();

const handleCloseTab = (tabId: string, event: MouseEvent) => {
  event.stopPropagation();
  tabsStore.removeTab(tabId);
};
</script>

<template>
  <div class="tab-bar">
    <TabItem
      v-for="tabId in tabsStore.tabOrder"
      :key="tabId"
      :tab-id="tabId"
      :active="tabId === tabsStore.activeTabId"
      @click="tabsStore.switchTab(tabId)"
      @close="handleCloseTab(tabId, $event)"
    />
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  background: var(--tab-bar-bg);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}
</style>
```

**验收标准:**
- [ ] 标签页显示正常
- [ ] 可以点击切换
- [ ] 有关闭按钮
- [ ] 激活状态显示正确
- [ ] 脏标记显示 (*)

---

### 任务 7: 文件打开/保存

**优先级:** P0  
**预计时间:** 4 小时  
**难度:** ⭐⭐⭐

**任务描述:**
实现文件的打开和保存功能

**实现细节:**

```typescript
// src/main/file-service.ts
import { promises as fs } from 'fs';
import path from 'path';

export class FileService {
  async openFile(filePath: string): Promise<{ content: string; encoding: string }> {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content, encoding: 'utf-8' };
  }
  
  async saveFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }
  
  async saveAsFile(defaultPath: string, content: string): Promise<string | null> {
    // 通过 dialog 选择路径
    // 实现略
    return null;
  }
}

// src/main/ipc-handlers.ts
import { FileService } from './file-service';

const fileService = new FileService();

ipcMain.handle('file:open', async (event, filePath: string) => {
  return await fileService.openFile(filePath);
});

ipcMain.handle('file:save', async (event, { filePath, content }) => {
  await fileService.saveFile(filePath, content);
});
```

**验收标准:**
- [ ] 可以打开文件
- [ ] 可以保存文件
- [ ] 可以另存为
- [ ] 错误处理完善

---

### 任务 8: 自动保存

**优先级:** P0  
**预计时间:** 2 小时  
**难度:** ⭐⭐

**任务描述:**
实现自动保存功能

**实现细节:**

```typescript
// src/renderer/stores/auto-save.ts
import { useDebounceFn } from '@vueuse/core';

export function useAutoSave(tabId: string) {
  const save = useDebounceFn(async () => {
    const tab = tabsStore.tabs.get(tabId);
    if (tab && tab.filePath && tab.isDirty) {
      await ipcRenderer.invoke('file:save', {
        filePath: tab.filePath,
        content: tab.content
      });
      tabsStore.updateTab(tabId, { 
        isDirty: false,
        lastSaved: Date.now()
      });
    }
  }, 1000); // 1 秒防抖
  
  return { save };
}
```

**验收标准:**
- [ ] 修改后自动保存
- [ ] 防抖正常
- [ ] 保存后清除脏标记

---

### 任务 9: 增强写作模式

**优先级:** P0  
**预计时间:** 3 小时  
**难度:** ⭐⭐⭐

**任务描述:**
实现打字机模式和专注模式

**实现细节:**

```typescript
// 打字机模式
function enableTypewriterMode(editor: Editor) {
  editor.listen((state) => {
    const cursorPosition = state.selection?.from;
    if (cursorPosition) {
      // 保持光标在视口中央
      const element = editor.view.nodeDOM(cursorPosition);
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ block: 'center' });
      }
    }
  });
}

// 专注模式
function enableFocusMode(editor: Editor) {
  editor.listen((state) => {
    const cursorPosition = state.selection?.from;
    // 高亮当前段落，弱化其他
    // 实现略
  });
}
```

**验收标准:**
- [ ] 打字机模式光标居中
- [ ] 专注模式高亮当前段落
- [ ] 可以开关

---

### 任务 10: 窗口管理 (Main Process)

**优先级:** P0  
**预计时间:** 4 小时  
**难度:** ⭐⭐⭐

**任务描述:**
实现 Electron 窗口管理

**实现细节:**

```typescript
// src/main/window-manager.ts
import { BrowserWindow } from 'electron';

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  
  createWindow(options: WindowOptions): BrowserWindow {
    const window = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    
    const windowId = generateId();
    this.windows.set(windowId, window);
    
    window.on('closed', () => {
      this.windows.delete(windowId);
    });
    
    return window;
  }
  
  getWindow(windowId: string): BrowserWindow | undefined {
    return this.windows.get(windowId);
  }
  
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }
}
```

**验收标准:**
- [ ] 可以创建窗口
- [ ] 窗口正常关闭
- [ ] 窗口状态跟踪

---

### 任务 11: IPC 通信基础

**优先级:** P0  
**预计时间:** 3 小时  
**难度:** ⭐⭐⭐

**任务描述:**
实现主进程和渲染进程的 IPC 通信

**实现细节:**

```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  openFile: (path: string) => ipcRenderer.invoke('file:open', path),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('file:save', { path, content }),
  
  // 窗口操作
  createWindow: () => ipcRenderer.invoke('window:create'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // 监听
  onFileChanged: (callback: (path: string) => void) => {
    ipcRenderer.on('file:changed', (event, path) => callback(path));
  }
});
```

**验收标准:**
- [ ] IPC 通道正常
- [ ] 类型安全
- [ ] 错误处理

---

### 任务 12: 基础 UI 布局

**优先级:** P0  
**预计时间:** 3 小时  
**难度:** ⭐⭐

**任务描述:**
实现应用的基础布局

**组件:**
- App.vue (主布局)
- TitleBar.vue (标题栏)
- MenuBar.vue (菜单栏)
- StatusBar.vue (状态栏)

**验收标准:**
- [ ] 布局完整
- [ ] 响应式
- [ ] 主题变量

---

## 🟡 P1 - 重要功能 (第二阶段)

### 任务 13-27: 侧边栏、多窗口、主题等

*(详细任务列表略，按照相同格式编写)*

**待实现任务:**
- 文件树组件
- 全局搜索
- 文章大纲
- 跨窗口迁移
- 主题系统
- 设置面板
- 快捷键系统
- 图片处理
- 导出功能
- 右键菜单
- 拖拽功能
- 窗口状态持久化
- 最近文件列表
- 错误处理
- 日志系统

---

## 🟢 P2 - 增强功能 (第三阶段)

### 任务 28-37: 导出、国际化、优化等

**待实现任务:**
- PDF 导出
- HTML 导出
- 国际化 (i18n)
- 性能优化
- 单元测试
- E2E 测试
- 文档完善
- 打包发布
- 自动更新
- 云同步 (可选)

---

## 📝 进度记录

### 2026-05-16

- [ ] 任务 1: 项目初始化 - 未开始
- [ ] 任务 2: Milkdown 编辑器集成 - 未开始
- [ ] 任务 3: 三种编辑模式 - 未开始
- ...

---

## 🎯 下一步

**立即开始:**
1. 任务 1: 项目初始化
2. 任务 2: Milkdown 编辑器集成
3. 任务 4: 标签页数据结构

**完成后继续:**
按 P0 → P1 → P2 顺序完成

---

**文档结束**
