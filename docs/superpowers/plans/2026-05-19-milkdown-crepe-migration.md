# Milkdown Crepe 迁移计划

> **目标：** 将编辑器从 Milkdown Core 迁移到 Crepe，优化架构达到最优

## 📋 迁移概述

### 当前架构分析

**优点（保留）：**
- ✅ LRU 内容缓存系统
- ✅ 多标签页管理架构
- ✅ 事件总线通信机制
- ✅ 性能监控系统
- ✅ 三种视图模式（WYSIWYG/源码/分屏）

**问题（修复）：**
- ❌ 使用过时的 Core API
- ❌ 手动管理多个插件
- ❌ 冗余的错误处理逻辑
- ❌ Polling 机制不必要（Crepe 已内置状态管理）

### 新架构设计

```
┌─────────────────────────────────────────┐
│        EditorContainer.vue               │
│  ┌───────────────────────────────────┐  │
│  │  Crepe WYSIWYG 编辑器              │  │
│  │  (Crepe Feature: WYSIWYG)        │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Source Mode (textarea)           │  │
│  │  同步 getMarkdown()              │  │
│  └───────────────────────────────────┘  │
│  ┌─────────────┬─────────────────────┐  │
│  │  Source     │  Preview           │  │
│  │  (textarea) │  (HTML render)    │  │
│  └─────────────┴─────────────────────┘  │
└─────────────────────────────────────────┘
         ↕ 事件总线
┌─────────────────────────────────────────┐
│      EditorManager (简化版)              │
│  - 包装 Crepe 实例                      │
│  - 管理多标签页内容                      │
│  - LRU 缓存（标签页内容）               │
│  - 模式切换同步                         │
└─────────────────────────────────────────┘
```

---

## 🎯 第一阶段：基础迁移（干净切换）

### 任务 1：备份和准备工作

- [ ] 创建备份分支 `backup-before-crepe`
- [ ] 备份当前 editorManager.ts
- [ ] 备份当前 EditorContainer.vue

### 任务 2：清理 package.json 依赖

**修改文件：** `package.json`

```json
// 删除过时依赖
- "@milkdown/core": "^7.5.0"
- "@milkdown/plugin-block": "^7.21.1"
- "@milkdown/plugin-history": "^7.5.0"
- "@milkdown/plugin-prism": "^7.5.0"
- "@milkdown/preset-commonmark": "^7.5.0"
- "@milkdown/preset-gfm": "^7.5.0"
- "@milkdown/prose": "^7.5.0"
- "@milkdown/transformer": "^7.5.0"

+ "@milkdown/crepe": "^7.5.0"
```

**保留依赖：**
- `@milkdown/plugin-clipboard` - 如果 Crepe 没有内置
- `prosemirror-search` - 搜索高亮功能
- `@vscode/ripgrep` - 全局搜索

### 任务 3：重写 EditorManager

**创建新文件：** `src/managers/crepeEditorManager.ts`

```typescript
import { Crepe, CrepeBuilder, CrepeFeature } from '@milkdown/crepe'
import type { ViewMode } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'
import { LRUCache } from '@/utils/performance'

export class CrepeEditorManager {
  private crepe: Crepe | null = null
  private contentCache: LRUCache<string>
  private currentTabId: string | null = null
  private currentMode: ViewMode = 'wysiwyg'

  constructor() {
    this.contentCache = new LRUCache<string>(10)
  }

  async init(container: HTMLElement, content: string, tabId?: string): Promise<void> {
    this.crepe = new CrepeBuilder({
      root: container,
      defaultValue: content,
      features: {
        [Crepe.Feature.BlockEdit]: true,      // 块编辑手柄
        [Crepe.Feature.Slash]: true,         // Slash 命令菜单
        [Crepe.Feature.CodeMirror]: true,    // 代码块语法高亮
        [Crepe.Feature.LinkTooltip]: true,    // 链接编辑
        [Crepe.Feature.ImageBlock]: true,     // 图片块
        [Crepe.Feature.Table]: true,          // 表格
        [Crepe.Feature.Toolbar]: false,      // 禁用自带工具栏（自定义）
        [Crepe.Feature.Placeholder]: true,   // 占位符
      }
    })
    .create()

    this.currentTabId = tabId || this.tabsStore.activeTabId
    this.content = content

    // 监听内容变化
    this.crepe.on((ctx) => {
      ctx.markdownUpdated((_ctx, markdown) => {
        if (this.currentTabId && markdown !== this.content) {
          this.content = markdown
          this.contentCache.set(this.currentTabId, markdown)
          this.tabsStore.updateTab(this.currentTabId, {
            content: markdown,
            isDirty: true,
            lastModified: Date.now()
          })
          eventBus.emit(AppEvents.CONTENT_CHANGED, {
            content: markdown,
            tabId: this.currentTabId
          })
        }
      })
    })
  }

  getMarkdown(): string {
    if (!this.crepe) return this.content
    return this.crepe.getMarkdown()
  }

  async setMarkdown(content: string): Promise<void> {
    if (!this.crepe || this.content === content) return
    this.content = content
    if (this.currentTabId) {
      this.contentCache.set(this.currentTabId, content)
    }
    // Crepe 内部会处理内容更新
    await this.crepe.setMarkdown(content)
  }

  getHTML(): string {
    if (!this.crepe) return ''
    let html = ''
    this.crepe.action((ctx) => {
      const serializer = ctx.get(serializerCtx)
      const view = ctx.get(editorViewCtx)
      if (serializer && view) {
        html = serializer(view.state.doc)
      }
    })
    return html
  }

  setViewMode(mode: ViewMode): void {
    this.currentMode = mode
  }

  async switchToTab(tabId: string): Promise<void> {
    const cachedContent = this.contentCache.get(tabId)
    const targetTab = this.tabsStore.tabs.get(tabId)
    if (!targetTab) return

    this.currentTabId = tabId
    const contentToLoad = cachedContent || targetTab.content
    await this.setMarkdown(contentToLoad)
  }

  async destroy(): Promise<void> {
    if (this.crepe) {
      await this.crepe.destroy()
      this.crepe = null
    }
    this.contentCache.clear()
  }

  isReady(): boolean {
    return this.crepe !== null
  }
}

export function useCrepeEditorManager() {
  // ... 组合式函数包装
}
```

### 任务 4：重写 EditorContainer.vue

**修改文件：** `src/components/Editor/EditorContainer.vue`

```vue
<template>
  <div class="editor-container">
    <FloatingSearch ref="floatingSearchRef" />
    
    <!-- WYSIWYG 模式 -->
    <div
      v-show="currentMode === EDITOR.VIEW_MODES.WYSIWYG"
      ref="wysiwygRef"
      class="wysiwyg-editor"
    />
    
    <!-- 源码模式 -->
    <textarea
      v-show="currentMode === EDITOR.VIEW_MODES.SOURCE"
      ref="sourceRef"
      v-model="sourceContent"
      class="source-editor"
      @input="handleSourceInput"
      @keydown="handleSourceKeydown"
      @scroll="handleSourceScroll"
    />
    
    <!-- 分屏模式 -->
    <div
      v-show="currentMode === EDITOR.VIEW_MODES.SPLIT"
      class="split-view"
    >
      <textarea
        ref="splitSourceRef"
        v-model="sourceContent"
        class="split-source"
        @input="handleSourceInput"
        @keydown="handleSourceKeydown"
        @scroll="handleSourceScroll"
      />
      <div
        ref="splitPreviewRef"
        class="split-preview"
        v-html="previewHTML"
        @scroll="handlePreviewScroll"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { eventBus, AppEvents } from '@/events/eventBus'
import { debounce } from '@/utils/helpers'
import { EDITOR } from '@/constants'
import type { ViewMode } from '@/types'
import FloatingSearch from './FloatingSearch.vue'

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const editorManager = inject<ReturnType<typeof import('@/managers/crepeEditorManager').useCrepeEditorManager>>('editorManager')

const wysiwygRef = ref<HTMLElement | null>(null)
const sourceRef = ref<HTMLTextAreaElement | null>(null)
const splitSourceRef = ref<HTMLTextAreaElement | null>(null)
const splitPreviewRef = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

const sourceContent = ref('')
const previewHTML = ref('')

const currentMode = editorManager?.currentMode || ref<ViewMode>('wysiwyg')
const showEditorToolbar = ref(false)

const activeTab = computed(() => tabsStore.activeTab)

// 监听标签页内容变化
watch(activeTab, (tab) => {
  if (tab) {
    sourceContent.value = tab.content
    updatePreview()
  }
}, { immediate: true })

// 模式切换处理
const handleViewModeChange = async (mode: ViewMode) => {
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG) {
    sourceContent.value = editorManager?.getMarkdown() || ''
  }
  
  if (mode === EDITOR.VIEW_MODES.WYSIWYG && 
      currentMode.value !== EDITOR.VIEW_MODES.WYSIWYG) {
    await editorManager?.setMarkdown(sourceContent.value)
  }
  
  editorManager?.setViewMode(mode)
}

// 源码输入处理
const handleSourceInput = debounce(() => {
  if (activeTab.value) {
    tabsStore.updateTab(activeTab.value.id, {
      content: sourceContent.value,
      isDirty: true
    })
    editorManager?.setMarkdown(sourceContent.value)
    updatePreview()
  }
}, 100)

// 更新预览
function updatePreview() {
  if (currentMode.value === EDITOR.VIEW_MODES.SPLIT) {
    previewHTML.value = editorManager?.getHTML() || ''
  }
}

onMounted(async () => {
  if (wysiwygRef.value) {
    await editorManager?.init(wysiwygRef.value, activeTab.value?.content || '')
  }
})

onUnmounted(async () => {
  await editorManager?.destroy()
})
</script>
```

---

## 🚀 第二阶段：架构优化（达到最优）

### 任务 5：优化性能监控

**保留：** LRUCache、PerformanceMonitor
**删除：** Polling 机制（Crepe 已内置状态管理）

```typescript
// crepeEditorManager.ts
class CrepeEditorManager {
  private performanceMonitor: PerformanceMonitor
  
  // 不再需要 Polling，Crepe 会自动通知内容变化
  async init() {
    this.performanceMonitor.measure('editorInit')
    // ...
    this.performanceMonitor.recordEditorReady()
  }
}
```

### 任务 6：优化错误处理

**简化：** 三重降级 → 单一错误边界

```typescript
async init(): Promise<void> {
  try {
    this.crepe = await new CrepeBuilder({...}).create()
  } catch (error) {
    console.error('[CrepeEditorManager] Init failed:', error)
    eventBus.emit(AppEvents.EDITOR_ERROR, { error })
    throw error
  }
}
```

### 任务 7：优化事件监听

**改进：** 使用 Crepe 的内置监听

```typescript
// Crepe 已内置 markdownUpdated 监听，不需要额外的 listener 插件
this.crepe.on((ctx) => {
  ctx.markdownUpdated((ctx, markdown, prevMarkdown) => {
    // 统一的内容更新逻辑
  })
})
```

---

## 📦 第三阶段：清理和验证

### 任务 8：清理遗留代码

**删除文件：**
- `src/managers/editorManager.ts`（旧）
- `src/types/milkdown.d.ts`（类型可能需要更新）
- `src/composables/useMilkdownContext.ts`（如果存在）

**更新导入：**
- `App.vue` - 改用新的 manager
- `clipboard.ts` - 改用新的 API
- 其他依赖 editorManager 的文件

### 任务 9：类型安全检查

```typescript
// 更新 milkdown.d.ts 或删除
// 确保 Crepe 的类型完整
import type { Crepe } from '@milkdown/crepe'

declare module '@milkdown/crepe' {
  interface Crepe {
    action<T>(callback: (ctx: CrepeContext) => T): T
    getMarkdown(): string
    setMarkdown(content: string): Promise<void>
    on(callback: (ctx: CrepeContext) => void): void
  }
}
```

### 任务 10：功能验证清单

- [ ] WYSIWYG 模式正常编辑
- [ ] 源码模式显示正确
- [ ] 分屏模式预览正确
- [ ] 模式切换无数据丢失
- [ ] 标签页切换正常
- [ ] 撤销/重做正常
- [ ] 搜索替换正常
- [ ] 复制粘贴正常
- [ ] 导出功能正常
- [ ] 性能指标正常输出

---

## 📊 任务清单总结

| 阶段 | 任务 | 优先级 | 预计时间 |
|------|------|--------|----------|
| **第一阶段** | 备份和准备 | P0 | 10min |
| **第一阶段** | 清理依赖 | P0 | 15min |
| **第一阶段** | 重写 EditorManager | P0 | 2h |
| **第一阶段** | 重写 EditorContainer | P0 | 1h |
| **第二阶段** | 优化性能监控 | P1 | 30min |
| **第二阶段** | 优化错误处理 | P1 | 30min |
| **第二阶段** | 优化事件监听 | P1 | 30min |
| **第三阶段** | 清理遗留代码 | P0 | 1h |
| **第三阶段** | 类型安全检查 | P1 | 30min |
| **第三阶段** | 功能验证 | P0 | 2h |

**总预计时间：** ~8小时

---

## ⚠️ 注意事项

1. **不要有遗留代码** - 每个任务完成后立即清理
2. **保持功能一致** - 三种模式的体验不能下降
3. **性能不能下降** - 保持或优化现有性能指标
4. **Git 提交** - 每个阶段完成后提交，保持清晰的提交历史
