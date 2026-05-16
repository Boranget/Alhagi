# Alhagi - 代码规范

**版本:** 1.0  
**用途:** AI 助手编码规范

---

## 📋 TypeScript 规范

### 1. 类型定义

```typescript
// ✅ 好的做法：使用接口定义复杂类型
interface TabState {
  id: string;
  content: string;
  isDirty: boolean;
}

// ✅ 使用类型别名定义联合类型
type ViewMode = 'wysiwyg' | 'source' | 'split';

// ✅ 使用泛型接口
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// ❌ 避免使用 any
function processData(data: any) {} // ❌

// ✅ 使用 unknown 或具体类型
function processData(data: unknown) {
  if (typeof data === 'string') {
    // 处理字符串
  }
}
```

### 2. 函数定义

```typescript
// ✅ 使用箭头函数
const handleClick = (event: MouseEvent) => {
  // 处理逻辑
};

// ✅ 明确返回值类型
function calculateTotal(price: number, tax: number): number {
  return price + tax;
}

// ✅ 异步函数
async function loadFile(path: string): Promise<string> {
  const content = await fs.readFile(path, 'utf-8');
  return content;
}

// ✅ 使用可选参数和默认值
function createTab(
  title: string,
  content: string = '',
  active: boolean = true
): TabState {
  // ...
}
```

### 3. 错误处理

```typescript
// ✅ 使用 try-catch 处理异步错误
async function saveFile(path: string, content: string) {
  try {
    await fs.writeFile(path, content, 'utf-8');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Save failed:', error.message);
      throw error;
    }
  }
}

// ✅ 自定义错误类型
class FileSaveError extends Error {
  constructor(path: string, cause: Error) {
    super(`Failed to save file: ${path}`);
    this.name = 'FileSaveError';
    this.cause = cause;
  }
}

// ✅ 使用 Result 类型
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

function parseJSON(str: string): Result<any> {
  try {
    return { success: true, data: JSON.parse(str) };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Unknown error')
    };
  }
}
```

---

## 🎨 Vue 3 组件规范

### 1. 组件结构

```vue
<!-- ✅ 使用 <script setup> -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTabsStore } from '@/stores/tabs';

// Props
interface Props {
  tabId: string;
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false
});

// Emits
interface Emits {
  (e: 'close', tabId: string): void;
  (e: 'click', tabId: string): void;
}

const emit = defineEmits<Emits>();

// State
const tabsStore = useTabsStore();
const isHovered = ref(false);

// Computed
const title = computed(() => {
  const tab = tabsStore.tabs.get(props.tabId);
  return tab?.title || 'Untitled';
});

const isDirty = computed(() => {
  const tab = tabsStore.tabs.get(props.tabId);
  return tab?.isDirty || false;
});

// Methods
const handleClose = (event: MouseEvent) => {
  event.stopPropagation();
  emit('close', props.tabId);
};

const handleClick = () => {
  emit('click', props.tabId);
};

// Lifecycle
onMounted(() => {
  console.log('TabItem mounted');
});
</script>

<template>
  <div
    class="tab-item"
    :class="{ active, 'is-dirty': isDirty }"
    @click="handleClick"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <span class="title">{{ title }}</span>
    <button
      v-show="isHovered"
      class="close-btn"
      @click="handleClose"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.tab-item {
  padding: 8px 16px;
  cursor: pointer;
}
</style>
```

### 2. Composables

```typescript
// ✅ 使用 composables 封装可复用逻辑
// src/renderer/composables/useEditor.ts

import { ref, onMounted, onUnmounted } from 'vue';
import type { EditorInstance } from '@/utils/editor-factory';

export function useEditor(containerId: string) {
  const editor = ref<EditorInstance | null>(null);
  const isReady = ref(false);
  
  const initialize = async () => {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    editor.value = await createEditorInstance(container);
    isReady.value = true;
  };
  
  const destroy = async () => {
    if (editor.value) {
      await editor.value.destroy();
      editor.value = null;
      isReady.value = false;
    }
  };
  
  onMounted(initialize);
  onUnmounted(destroy);
  
  return {
    editor,
    isReady,
    destroy
  };
}

// 使用
const { editor, isReady } = useEditor('editor-container');
```

### 3. Pinia Store

```typescript
// ✅ Store 组织方式
// src/renderer/stores/tabs.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TabState } from '@/shared/types';

export const useTabsStore = defineStore('tabs', () => {
  // ===== State =====
  const tabs = ref(new Map<string, TabState>());
  const activeTabId = ref<string | null>(null);
  
  // ===== Getters =====
  const activeTab = computed(() => {
    if (!activeTabId.value) return null;
    return tabs.value.get(activeTabId.value) || null;
  });
  
  const dirtyTabs = computed(() => {
    return Array.from(tabs.value.values()).filter(tab => tab.isDirty);
  });
  
  // ===== Actions =====
  function createTab(options: Partial<TabState> = {}): TabState {
    const id = generateUUID();
    const tab: TabState = {
      id,
      // ... 初始化
    } as TabState;
    
    tabs.value.set(id, tab);
    return tab;
  }
  
  async function switchTab(tabId: string) {
    // 实现
  }
  
  // ===== 导出 =====
  return {
    // State
    tabs,
    activeTabId,
    
    // Getters
    activeTab,
    dirtyTabs,
    
    // Actions
    createTab,
    switchTab
  };
});
```

---

## 💅 CSS/SCSS 规范

### 1. 命名规范

```scss
// ✅ 使用 BEM 命名
.tab-item {
  // 块
}

.tab-item__title {
  // 元素
}

.tab-item--active {
  // 修饰符
}

.tab-item__close-btn:hover {
  // 组合
}

// ✅ 使用 CSS 变量
.editor {
  background-color: var(--editor-bg);
  color: var(--editor-text);
}
```

### 2. 样式组织

```scss
// ✅ 按功能组织
// src/renderer/styles/main.scss

// 变量
@import './variables';

// Mixins
@import './mixins';

// 基础样式
@import './base';

// 组件样式
@import './components/editor';
@import './components/tabs';
@import './components/sidebar';

// 主题
@import './themes/light';
@import './themes/dark';
```

### 3. 响应式

```scss
// ✅ 使用媒体查询
.container {
  width: 100%;
  max-width: 1200px;
  
  @media (max-width: 768px) {
    padding: 10px;
  }
  
  @media (min-width: 769px) {
    padding: 20px;
  }
}
```

---

## 📁 文件组织

### 1. 文件命名

```
✅ 好的做法:
- TabItem.vue (PascalCase for 组件)
- useEditor.ts (camelCase for composables)
- types.ts (共享类型)
- editor-factory.ts (工具函数)

❌ 避免:
- tab-item.vue
- UseEditor.ts
- Types.ts
```

### 2. 目录结构

```
src/
├── components/          # 可复用组件
│   ├── Editor/
│   ├── Tabs/
│   └── Sidebar/
├── views/              # 页面组件
├── stores/             # Pinia stores
├── composables/        # Composables
├── utils/              # 工具函数
└── types/              # TypeScript 类型
```

---

## 🔍 代码质量

### 1. ESLint 规则

```javascript
// .eslintrc.cjs
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
    'vue/multi-word-component-names': 'off',
    'prefer-const': 'error',
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off'
  }
};
```

### 2. Prettier 配置

```javascript
// .prettierrc
module.exports = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none',
  printWidth: 100,
  endOfLine: 'auto'
};
```

---

## 📝 注释规范

### 1. 文档注释

```typescript
/**
 * 创建编辑器实例
 * 
 * @param root - 挂载点元素
 * @param options - 编辑器选项
 * @returns 编辑器实例
 * 
 * @example
 * ```typescript
 * const editor = await createEditorInstance(root, {
 *   defaultValue: 'Hello'
 * });
 * ```
 */
export async function createEditorInstance(
  root: HTMLElement,
  options?: EditorOptions
): Promise<EditorInstance> {
  // 实现
}
```

### 2. 行内注释

```typescript
// ✅ 解释为什么，而不是是什么
// 使用防抖避免频繁保存
const save = useDebounceFn(async () => {
  // ...
}, 1000);

// ✅ 标记 TODO
// TODO: 实现历史记录压缩
function compressHistory(stack: HistoryItem[]) {
  // ...
}

// ✅ 标记注意事项
// NOTE: 必须在组件卸载前调用
onUnmounted(async () => {
  await editor.destroy();
});
```

---

## 🧪 测试规范

### 1. 单元测试

```typescript
// ✅ Vitest 测试
// tests/unit/stores/tabs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTabsStore } from '@/stores/tabs';

describe('useTabsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  
  it('should create a new tab', () => {
    const store = useTabsStore();
    const tab = store.createTab({ title: 'Test' });
    
    expect(tab.title).toBe('Test');
    expect(store.tabs.size).toBe(1);
  });
  
  it('should switch tabs', async () => {
    const store = useTabsStore();
    const tab1 = store.createTab({ title: 'Tab 1' });
    const tab2 = store.createTab({ title: 'Tab 2' });
    
    await store.switchTab(tab2.id);
    
    expect(store.activeTabId).toBe(tab2.id);
  });
});
```

### 2. 组件测试

```typescript
// ✅ Vue 组件测试
// tests/unit/components/TabItem.test.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import TabItem from '@/components/Tabs/TabItem.vue';

describe('TabItem', () => {
  it('should render title correctly', () => {
    const wrapper = mount(TabItem, {
      props: {
        tabId: '1',
        active: false
      }
    });
    
    expect(wrapper.text()).toContain('Test Tab');
  });
  
  it('should emit close event', async () => {
    const wrapper = mount(TabItem, {
      props: { tabId: '1' }
    });
    
    await wrapper.find('.close-btn').trigger('click');
    
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
```

---

## ⚡ 性能优化

### 1. 组件优化

```vue
<script setup lang="ts">
// ✅ 使用 shallowRef 处理大型对象
import { shallowRef, triggerRefChange } from 'vue';

const largeData = shallowRef<LargeObject>(initialData);

function updateData() {
  largeData.value.someProperty = 'new value';
  triggerRefChange(largeData); // 手动触发更新
}

// ✅ 使用 v-memo 缓存模板
<div v-memo="[count]">
  {{ expensiveRender() }}
</div>
</script>
```

### 2. 列表优化

```vue
<!-- ✅ 使用虚拟滚动 -->
<script setup lang="ts">
import { useVirtualList } from '@vueuse/core';

const { list, containerProps, wrapperProps } = useVirtualList(
  largeList,
  { itemHeight: 50 }
);
</script>

<template>
  <div v-bind="containerProps">
    <div v-bind="wrapperProps">
      <div
        v-for="{ index, data } in list"
        :key="index"
        class="virtual-item"
      >
        {{ data }}
      </div>
    </div>
  </div>
</template>
```

---

## 🔒 安全规范

### 1. IPC 安全

```typescript
// ✅ 验证 IPC 消息
ipcMain.handle('file:open', async (event, filePath: string) => {
  // 验证路径
  if (!path.isAbsolute(filePath)) {
    throw new Error('Invalid path');
  }
  
  // 防止路径遍历攻击
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(userHome)) {
    throw new Error('Access denied');
  }
  
  return await fs.readFile(filePath, 'utf-8');
});
```

### 2. XSS 防护

```typescript
// ✅ 清理用户输入
import DOMPurify from 'dompurify';

function renderMarkdown(content: string): string {
  const html = markdownToHtml(content);
  return DOMPurify.sanitize(html);
}
```

---

## 📊 代码审查清单

提交前检查:

- [ ] TypeScript 无错误
- [ ] ESLint 检查通过
- [ ] Prettier 格式化
- [ ] 测试通过
- [ ] 类型定义完整
- [ ] 错误处理完善
- [ ] 注释清晰
- [ ] 无 console.log (生产环境)
- [ ] 无内存泄漏风险

---

**文档结束**
