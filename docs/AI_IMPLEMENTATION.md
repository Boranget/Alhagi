# Alhagi - 技术实现细节

**版本:** 1.0  
**用途:** AI 助手开发时的技术参考

---

## 📐 项目结构

```
alhagi/
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── main.ts                # 主进程入口
│   │   ├── window-manager.ts      # 窗口管理
│   │   ├── ipc-handlers.ts        # IPC 处理器
│   │   ├── file-service.ts        # 文件服务
│   │   └── app-menu.ts            # 应用菜单
│   │
│   ├── renderer/                  # 渲染进程 (Vue 3)
│   │   ├── main.ts                # 渲染进程入口
│   │   ├── App.vue                # 根组件
│   │   │
│   │   ├── components/
│   │   │   ├── Editor/
│   │   │   │   ├── EditorContainer.vue
│   │   │   │   ├── SourceEditor.vue
│   │   │   │   └── SplitView.vue
│   │   │   │
│   │   │   ├── Tabs/
│   │   │   │   ├── TabBar.vue
│   │   │   │   └── TabItem.vue
│   │   │   │
│   │   │   ├── Sidebar/
│   │   │   │   ├── Sidebar.vue
│   │   │   │   ├── FileExplorer.vue
│   │   │   │   ├── SearchPanel.vue
│   │   │   │   └── Outline.vue
│   │   │   │
│   │   │   ├── MenuBar/
│   │   │   │   ├── MenuBar.vue
│   │   │   │   └── MenuDropdown.vue
│   │   │   │
│   │   │   └── StatusBar/
│   │   │       └── StatusBar.vue
│   │   │
│   │   ├── stores/
│   │   │   ├── window.ts          # 窗口状态
│   │   │   ├── tabs.ts            # 标签页状态
│   │   │   ├── preferences.ts     # 偏好设置
│   │   │   └── theme.ts           # 主题状态
│   │   │
│   │   ├── composables/
│   │   │   ├── useEditor.ts       # 编辑器逻辑
│   │   │   ├── useFileWatcher.ts  # 文件监听
│   │   │   └── useAutoSave.ts     # 自动保存
│   │   │
│   │   └── utils/
│   │       ├── editor-factory.ts  # 编辑器工厂
│   │       ├── state-serializer.ts # 状态序列化
│   │       └── ipc-bridge.ts      # IPC 桥接
│   │
│   ├── preload/
│   │   └── preload.ts             # Preload 脚本
│   │
│   └── shared/
│       └── types.ts               # TypeScript 类型定义
│
├── resources/
│   ├── icons/                     # 图标资源
│   └── themes/                    # 主题文件
│
├── tests/
│   ├── unit/                      # 单元测试
│   └── e2e/                       # E2E 测试
│
└── build/                         # 构建配置
    ├── electron-builder.yml
    └── notarization.js
```

---

## 🔧 核心实现

### 1. Milkdown 编辑器工厂

```typescript
// src/renderer/utils/editor-factory.ts
import { Editor } from '@milkdown/core';
import { crepe } from '@milkdown/crete';
import { listener } from '@milkdown/plugin-listener';
import type { TabState } from '../../shared/types';

export interface EditorInstance {
  editor: Editor;
  setMarkdown(content: string): void;
  getMarkdown(): string;
  setSelection(from: number, to: number): void;
  getSelection(): { from: number; to: number };
  setScrollTop(position: number): void;
  getScrollTop(): number;
  setUndoStack(stack: any[]): void;
  getUndoStack(): any[];
  setRedoStack(stack: any[]): void;
  getRedoStack(): any[];
  destroy(): Promise<void>;
}

export async function createEditorInstance(
  root: HTMLElement,
  options: {
    defaultValue?: string;
    theme?: 'light' | 'dark';
  } = {}
): Promise<EditorInstance> {
  const editor = crepe({
    root,
    defaultValue: options.defaultValue || '',
    features: {
      image: { 
        upload: false,
        compression: true 
      },
      table: { enabled: true },
      math: { enabled: true },
      codeBlock: { 
        syntaxHighlight: true,
        theme: 'default'
      }
    },
    theme: options.theme === 'dark' ? 'dark' : 'light'
  });

  await editor.create();

  // 添加状态监听
  editor.listen((state) => {
    console.log('Editor state changed:', state);
  });

  return {
    editor,
    
    setMarkdown(content: string) {
      const { state, dispatch } = editor.view;
      const tr = state.tr;
      tr.replaceWith(0, state.doc.content.size, editor.view.state.schema.text(content));
      dispatch(tr);
    },
    
    getMarkdown(): string {
      return editor.getMarkdown();
    },
    
    setSelection(from: number, to: number) {
      const { state, dispatch } = editor.view;
      const tr = state.tr;
      tr.setSelection(TextSelection.create(state.doc, from, to));
      dispatch(tr);
    },
    
    getSelection(): { from: number; to: number } {
      const selection = editor.view.state.selection;
      return {
        from: selection.from,
        to: selection.to
      };
    },
    
    setScrollTop(position: number) {
      const container = editor.view.dom.parentElement;
      if (container) {
        container.scrollTop = position;
      }
    },
    
    getScrollTop(): number {
      const container = editor.view.dom.parentElement;
      return container?.scrollTop || 0;
    },
    
    setUndoStack(stack: any[]) {
      // Milkdown 历史栈实现
      // 具体实现取决于 Milkdown 版本
    },
    
    getUndoStack(): any[] {
      // 获取历史栈
      return [];
    },
    
    setRedoStack(stack: any[]) {
      // 设置重做栈
    },
    
    getRedoStack(): any[] {
      return [];
    },
    
    async destroy() {
      await editor.destroy();
    }
  };
}
```

---

### 2. 标签页状态管理 (Pinia)

```typescript
// src/renderer/stores/tabs.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TabState, HistoryItem } from '../../shared/types';
import { useDebounceFn } from '@vueuse/core';

export const useTabsStore = defineStore('tabs', () => {
  // State
  const tabs = ref(new Map<string, TabState>());
  const activeTabId = ref<string | null>(null);
  const tabOrder = ref<string[]>([]);
  
  // Getters
  const activeTab = computed(() => {
    if (!activeTabId.value) return null;
    return tabs.value.get(activeTabId.value) || null;
  });
  
  const dirtyTabs = computed(() => {
    return Array.from(tabs.value.values()).filter(tab => tab.isDirty);
  });
  
  const tabCount = computed(() => tabs.value.size);
  
  // Actions
  function createTab(options: {
    filePath?: string;
    content?: string;
    title?: string;
  } = {}): TabState {
    const id = generateUUID();
    const tab: TabState = {
      id,
      filePath: options.filePath || null,
      content: options.content || '',
      isDirty: false,
      title: options.title || '未命名',
      active: false,
      cursor: { from: 0, to: 0 },
      scrollTop: 0,
      viewMode: 'wysiwyg',
      undoStack: [],
      redoStack: [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      lastSaved: null
    };
    
    tabs.value.set(id, tab);
    tabOrder.value.push(id);
    
    return tab;
  }
  
  function removeTab(tabId: string) {
    tabs.value.delete(tabId);
    tabOrder.value = tabOrder.value.filter(id => id !== tabId);
    
    // 如果删除的是当前标签，切换到相邻标签
    if (activeTabId.value === tabId && tabOrder.value.length > 0) {
      const index = tabOrder.value.indexOf(tabId);
      const nextIndex = Math.min(index, tabOrder.value.length - 1);
      activeTabId.value = tabOrder.value[nextIndex];
    } else if (tabOrder.value.length === 0) {
      activeTabId.value = null;
    }
  }
  
  async function switchTab(tabId: string) {
    // 保存当前标签页状态
    if (activeTabId.value) {
      await saveCurrentTabState();
    }
    
    // 更新激活状态
    activeTabId.value = tabId;
    
    // 更新所有标签的 active 标记
    tabs.value.forEach(tab => {
      tab.active = (tab.id === tabId);
    });
    
    // 恢复目标标签页状态
    await restoreTabState(tabId);
  }
  
  async function saveCurrentTabState() {
    const tab = activeTab.value;
    if (!tab || !window.editorInstance) return;
    
    const editor = window.editorInstance;
    
    // 等待编辑器完成当前操作
    await editor.editor.flush();
    
    // 保存所有状态
    tab.content = editor.getMarkdown();
    tab.cursor = editor.getSelection();
    tab.scrollTop = editor.getScrollTop();
    tab.undoStack = editor.getUndoStack();
    tab.redoStack = editor.getRedoStack();
    tab.lastModified = Date.now();
  }
  
  async function restoreTabState(tabId: string) {
    const tab = tabs.value.get(tabId);
    if (!tab || !window.editorInstance) return;
    
    const editor = window.editorInstance;
    
    // 恢复内容
    editor.setMarkdown(tab.content);
    
    // 恢复光标
    editor.setSelection(tab.cursor.from, tab.cursor.to);
    
    // 恢复滚动
    editor.setScrollTop(tab.scrollTop);
    
    // 恢复历史栈
    editor.setUndoStack(tab.undoStack);
    editor.setRedoStack(tab.redoStack);
  }
  
  function updateTab(tabId: string, updates: Partial<TabState>) {
    const tab = tabs.value.get(tabId);
    if (tab) {
      Object.assign(tab, updates);
    }
  }
  
  // 自动保存
  const autoSave = useDebounceFn(async () => {
    const dirty = dirtyTabs.value;
    for (const tab of dirty) {
      if (tab.filePath) {
        await window.electronAPI?.saveFile(tab.filePath, tab.content);
        updateTab(tab.id, { 
          isDirty: false,
          lastSaved: Date.now()
        });
      }
    }
  }, 1000);
  
  return {
    // State
    tabs,
    activeTabId,
    tabOrder,
    
    // Getters
    activeTab,
    dirtyTabs,
    tabCount,
    
    // Actions
    createTab,
    removeTab,
    switchTab,
    updateTab,
    saveCurrentTabState,
    restoreTabState,
    autoSave
  };
});
```

---

### 3. IPC 通信实现

```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { TabState } from '../shared/types';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // ===== 文件操作 =====
  
  async openFile(filePath: string): Promise<{ content: string; encoding: string }> {
    return ipcRenderer.invoke('file:open', filePath);
  },
  
  async saveFile(filePath: string, content: string): Promise<void> {
    return ipcRenderer.invoke('file:save', { filePath, content });
  },
  
  async saveAsFile(defaultPath: string, content: string): Promise<string | null> {
    return ipcRenderer.invoke('file:saveAs', { defaultPath, content });
  },
  
  // ===== 窗口操作 =====
  
  async createWindow(): Promise<string> {
    return ipcRenderer.invoke('window:create');
  },
  
  async closeWindow(): Promise<void> {
    return ipcRenderer.invoke('window:close');
  },
  
  async minimizeWindow(): Promise<void> {
    return ipcRenderer.invoke('window:minimize');
  },
  
  async maximizeWindow(): Promise<void> {
    return ipcRenderer.invoke('window:maximize');
  },
  
  async setAlwaysOnTop(flag: boolean): Promise<void> {
    return ipcRenderer.invoke('window:setAlwaysOnTop', flag);
  },
  
  // ===== 标签页迁移 =====
  
  async moveTabToWindow(
    fromWindowId: string,
    toWindowId: string,
    tabId: string,
    state: TabState
  ): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('tab:move', {
      fromWindowId,
      toWindowId,
      tabId,
      state
    });
  },
  
  // ===== 对话框 =====
  
  async showOpenDialog(options: any): Promise<{ filePaths: string[] }> {
    return ipcRenderer.invoke('dialog:showOpenDialog', options);
  },
  
  async showSaveDialog(options: any): Promise<{ filePath: string | null }> {
    return ipcRenderer.invoke('dialog:showSaveDialog', options);
  },
  
  // ===== 事件监听 =====
  
  onFileChanged(callback: (filePath: string) => void) {
    ipcRenderer.on('file:changed', (event, filePath) => {
      callback(filePath);
    });
  },
  
  onTabAdded(callback: (data: { tabId: string; state: TabState }) => void) {
    ipcRenderer.on('tab:added', (event, data) => {
      callback(data);
    });
  },
  
  onTabRemoved(callback: (tabId: string) => void) {
    ipcRenderer.on('tab:removed', (event, tabId) => {
      callback(tabId);
    });
  },
  
  // ===== 清理 =====
  
  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel);
  }
});

// 类型声明
declare global {
  interface Window {
    electronAPI?: typeof window.electronAPI;
  }
}
```

---

### 4. 主进程 IPC 处理

```typescript
// src/main/ipc-handlers.ts
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { FileService } from './file-service';
import { WindowManager } from './window-manager';
import type { TabState } from '../shared/types';

const fileService = new FileService();
const windowManager = new WindowManager();

export function setupIPCHandlers() {
  // ===== 文件操作 =====
  
  ipcMain.handle('file:open', async (event, filePath: string) => {
    try {
      const { content, encoding } = await fileService.openFile(filePath);
      return { content, encoding };
    } catch (error) {
      console.error('Failed to open file:', error);
      throw error;
    }
  });
  
  ipcMain.handle('file:save', async (event, { filePath, content }) => {
    try {
      await fileService.saveFile(filePath, content);
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  });
  
  ipcMain.handle('file:saveAs', async (event, { defaultPath, content }) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(window!, {
        defaultPath,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (!result.canceled && result.filePath) {
        await fileService.saveFile(result.filePath, content);
        return result.filePath;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to save as:', error);
      throw error;
    }
  });
  
  // ===== 窗口操作 =====
  
  ipcMain.handle('window:create', async (event) => {
    const window = windowManager.createWindow();
    return window.id.toString();
  });
  
  ipcMain.handle('window:close', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });
  
  ipcMain.handle('window:minimize', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });
  
  ipcMain.handle('window:maximize', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });
  
  ipcMain.handle('window:setAlwaysOnTop', async (event, flag) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.setAlwaysOnTop(flag);
  });
  
  // ===== 标签页迁移 =====
  
  ipcMain.handle('tab:move', async (event, { fromWindowId, toWindowId, tabId, state }) => {
    try {
      // 1. 通知源窗口移除标签页
      const fromWindow = windowManager.getWindow(fromWindowId);
      fromWindow?.webContents.send('tab:removed', tabId);
      
      // 2. 通知目标窗口添加标签页
      const toWindow = windowManager.getWindow(toWindowId);
      toWindow?.webContents.send('tab:added', { tabId, state });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to move tab:', error);
      return { success: false, error: error.message };
    }
  });
  
  // ===== 对话框 =====
  
  ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(window!, options);
    return result;
  });
  
  ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(window!, options);
    return result;
  });
}
```

---

### 5. 文件服务

```typescript
// src/main/file-service.ts
import { promises as fs } from 'fs';
import path from 'path';
import chokidar from 'chokidar';

export interface FileChange {
  type: 'change' | 'rename' | 'delete';
  path: string;
  content?: string;
}

export class FileService {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  
  async openFile(filePath: string): Promise<{ content: string; encoding: string }> {
    // 验证路径
    if (!path.isAbsolute(filePath)) {
      throw new Error('File path must be absolute');
    }
    
    // 检查文件是否存在
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('Not a file');
    }
    
    // 检查大小 (限制 10MB)
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error('File too large (max 10MB)');
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    return { content, encoding: 'utf-8' };
  }
  
  async saveFile(filePath: string, content: string): Promise<void> {
    // 验证路径
    if (!path.isAbsolute(filePath)) {
      throw new Error('File path must be absolute');
    }
    
    // 确保目录存在
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // 写入文件
    await fs.writeFile(filePath, content, 'utf-8');
  }
  
  watchFile(
    filePath: string,
    callback: (change: FileChange) => void
  ): () => void {
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });
    
    const onChange = async () => {
      try {
        const content = await this.openFile(filePath);
        callback({
          type: 'change',
          path: filePath,
          content: content.content
        });
      } catch (error) {
        console.error('Error reading watched file:', error);
      }
    };
    
    watcher.on('change', onChange);
    watcher.on('unlink', () => {
      callback({ type: 'delete', path: filePath });
      this.watchers.delete(filePath);
    });
    
    this.watchers.set(filePath, watcher);
    
    // 返回取消监听函数
    return () => {
      watcher.close();
      this.watchers.delete(filePath);
    };
  }
  
  unwatchFile(filePath: string) {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }
}
```

---

### 6. 工具函数

```typescript
// src/shared/utils.ts

/**
 * 生成 UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 从文件路径提取标题
 */
export function extractTitleFromPath(filePath: string): string {
  return path.basename(filePath, '.md');
}

/**
 * 从内容提取标题 (第一个 heading)
 */
export function extractTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : '未命名';
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 格式化字数统计
 */
export function formatWordCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  } else if (count < 10000) {
    return (count / 1000).toFixed(1) + 'k';
  } else {
    return (count / 10000).toFixed(1) + 'w';
  }
}
```

---

## 🎨 主题系统

```typescript
// src/renderer/stores/theme.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<'light' | 'dark'>('light');
  
  function setTheme(theme: 'light' | 'dark') {
    currentTheme.value = theme;
    document.documentElement.setAttribute('data-theme', theme);
    
    // 保存到本地存储
    localStorage.setItem('theme', theme);
  }
  
  function toggleTheme() {
    setTheme(currentTheme.value === 'light' ? 'dark' : 'light');
  }
  
  function loadTheme() {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
    } else {
      // 根据系统偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }
  
  return {
    currentTheme,
    setTheme,
    toggleTheme,
    loadTheme
  };
});
```

```css
/* src/renderer/styles/variables.css */
:root {
  /* 浅色主题 */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
  --primary-color: #409EFF;
  --danger-color: #F56C6C;
  
  /* 编辑器 */
  --editor-bg: #ffffff;
  --editor-text: #333333;
  --editor-selection: #B3D8FF;
  
  /* 标签栏 */
  --tab-bg: #f0f0f0;
  --tab-active-bg: #ffffff;
  --tab-hover-bg: #e8e8e8;
}

[data-theme='dark'] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --text-primary: #d4d4d4;
  --text-secondary: #9cdcfe;
  --border-color: #404040;
  --primary-color: #4fc3f7;
  --danger-color: #ef5350;
  
  --editor-bg: #1e1e1e;
  --editor-text: #d4d4d4;
  --editor-selection: #264f78;
  
  --tab-bg: #252526;
  --tab-active-bg: #1e1e1e;
  --tab-hover-bg: #2a2d2e;
}
```

---

## ⚠️ 常见陷阱

### 1. 编辑器状态不同步

**问题:** 切换标签页时状态丢失

**解决方案:**
```typescript
// 必须在切换前等待编辑器完成操作
await editor.editor.flush();

// 然后再保存状态
tab.content = editor.getMarkdown();
```

### 2. IPC 通信阻塞

**问题:** 大文件迁移时 IPC 消息过大

**解决方案:**
```typescript
// 分块传输
const MAX_CHUNK_SIZE = 10 * 1024 * 1024;
const chunks = [];
for (let i = 0; i < serialized.length; i += MAX_CHUNK_SIZE) {
  chunks.push(serialized.slice(i, i + MAX_CHUNK_SIZE));
}
```

### 3. 内存泄漏

**问题:** 文件监听器未清理

**解决方案:**
```typescript
// 组件卸载时清理
onUnmounted(() => {
  if (unwatchFn) {
    unwatchFn();
  }
});
```

---

## 📚 参考资料

- [Milkdown 文档](https://milkdown.dev/)
- [Electron 文档](https://www.electronjs.org/)
- [Vue 3 文档](https://vuejs.org/)
- [Pinia 文档](https://pinia.vuejs.org/)

---

**文档结束**
