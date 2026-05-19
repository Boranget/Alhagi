# Milkdown Crepe 迁移计划（基于官方 Playground 架构）

> **目标：** 使用官方 Playground 的架构模式，将编辑器迁移到 Crepe，达到最优架构  
> **参考：** `website-main/src/components/playground/` 目录下的官方实现

## 📊 官方 Playground 架构分析

### 核心实现（必须参考）

```typescript
// 官方 Crepe.tsx - 关键实现
const crepe = new Crepe({
  root: divRef.current,
  defaultValue: content,
  featureConfigs: {
    [Crepe.Feature.CodeMirror]: { theme: darkMode ? undefined : eclipse },
    [Crepe.Feature.LinkTooltip]: { onCopyLink: () => toast('Link copied') },
  },
})

crepe.editor
  .config((ctx) => {
    ctx.get(listenerCtx).markdownUpdated(
      throttle((_, markdown) => { onChange(markdown) }, 200)
    )
  })
  .use(listener)

crepe.create().then(() => { crepeRef.current = crepe })

// 更新内容（通过 ProseMirror Transaction）
crepe.editor.action((ctx) => {
  const view = ctx.get(editorViewCtx)
  const parser = ctx.get(parserCtx)
  const doc = parser(markdown)
  if (!doc) return
  const state = view.state
  let tr = state.tr.replace(0, state.doc.content.size, new Slice(doc.content, 0, 0))
  tr = tr.setSelection(Selection.near(tr.doc.resolve(Math.min(from, doc.content.size - 2))))
  view.dispatch(tr)
})
```

### 双编辑器同步机制

```
┌──────────────────┐  throttled (200ms)  ┌──────────────────┐
│   Crepe WYSIWYG  │ ──────────────────→ │  CodeMirror 源码  │
│                  │                      │                  │
│                  │ ←──────────────────── │                  │
└──────────────────┘  debounced (200ms)  └──────────────────┘
```

---

## 🎯 架构设计（Vue 3 + Pinia）

### 新架构图

```
┌─────────────────────────────────────────────────────────────┐
│                  EditorContainer.vue                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WYSIWYG Mode                                         │  │
│  │  <div ref="crepeContainer" />                        │  │
│  │  - Crepe 编辑器实例                                   │  │
│  │  - 监听 markdownUpdated (throttle 200ms)              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Source Mode                                           │  │
│  │  <textarea v-model="sourceContent" />                │  │
│  │  - 监听 input (debounce 100ms)                        │  │
│  │  - 调用 crepe.editor.action() 更新                   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────┬───────────────────────────────┐│
│  │  Split Mode              │                               ││
│  │  ┌───────────────────┐  │  ┌─────────────────────────┐ ││
│  │  │ Source (textarea)│  │  │ Preview (div v-html)   │ ││
│  │  └───────────────────┘  │  └─────────────────────────┘ ││
│  │  - 与 Source Mode 共享   │  - getHTML() 渲染           ││
│  └─────────────────────────┴───────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│              useCrepeEditor (Composable)                     │
│  - 管理 Crepe 实例                                          │
│  - 内容同步（throttle/debounce）                            │
│  - 标签页管理                                               │
│  - LRU 缓存（保留）                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 详细任务清单

### 阶段一：基础设施（干净切换）

#### 任务 1：备份和依赖清理

**文件：** `package.json`

```json
// 删除过时依赖（保留 @milkdown/crepe）
- "@milkdown/core": "^7.5.0"
- "@milkdown/plugin-block": "^7.21.1"
- "@milkdown/plugin-history": "^7.5.0"
- "@milkdown/plugin-prism": "^7.5.0"
- "@milkdown/preset-commonmark": "^7.5.0"
- "@milkdown/preset-gfm": "^7.5.0"
- "@milkdown/prose": "^7.5.0"
- "@milkdown/transformer": "^7.5.0"

+ "@milkdown/crepe": "^7.5.0"
+ "@milkdown/kit": "^7.21.0"  // 用于 editorViewCtx, parserCtx 等
+ "@milkdown/plugin-clipboard": "^7.5.0"  // 如果需要
```

**执行命令：**
```bash
cd d:\selfproject\alhgi\alhagi
git branch backup-before-crepe
npm uninstall @milkdown/core @milkdown/plugin-block @milkdown/plugin-history @milkdown/plugin-prism @milkdown/preset-commonmark @milkdown/preset-gfm @milkdown/prose @milkdown/transformer
npm install @milkdown/crepe@latest @milkdown/kit@latest
```

#### 任务 2：创建 Crepe Editor Manager

**新建文件：** `src/managers/crepeEditorManager.ts`

**参考：** `website-main/src/components/playground/Crepe.tsx`

```typescript
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { editorViewCtx, parserCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Slice } from '@milkdown/kit/prose/model'
import { Selection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'
import { LRUCache } from '@/utils/performance'
import { debounce } from '@/utils/helpers'
import type { ViewMode } from '@/types'

export class CrepeEditorManager {
  private crepe: Crepe | null = null
  private content: string = ''
  private currentTabId: string | null = null
  private currentMode: ViewMode = 'wysiwyg'
  private contentCache: LRUCache<string>
  private isUpdatingContent = false

  constructor() {
    this.contentCache = new LRUCache<string>(10)
  }

  async init(container: HTMLElement, initialContent: string = '', tabId?: string): Promise<void> {
    this.currentTabId = tabId || this.tabsStore.activeTabId
    this.content = initialContent

    // 创建 Crepe 实例（参考官方实现）
    this.crepe = new Crepe({
      root: container,
      defaultValue: initialContent,
      features: {
        [Crepe.Feature.BlockEdit]: true,     // 块编辑手柄
        [Crepe.Feature.Slash]: true,          // Slash 命令菜单
        [Crepe.Feature.CodeMirror]: true,     // 代码块语法高亮
        [Crepe.Feature.LinkTooltip]: true,    // 链接编辑
        [Crepe.Feature.ImageBlock]: true,      // 图片块
        [Crepe.Feature.Table]: true,          // 表格
        [Crepe.Feature.Toolbar]: false,      // 禁用自带工具栏
        [Crepe.Feature.Placeholder]: true,    // 占位符
        [Crepe.Feature.ListItem]: true,       // 列表项
        [Crepe.Feature.Cursor]: true,         // 光标增强
      },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          // 可以自定义主题
        },
      },
    })

    // 配置监听器（参考官方实现，使用 throttle）
    this.crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(
          debounce((_: unknown, markdown: string) => {
            this.handleMarkdownUpdate(markdown)
          }, 200)
        )
      })
      .use(listener)

    await this.crepe.create()

    // 缓存初始内容
    if (this.currentTabId) {
      this.contentCache.set(this.currentTabId, initialContent)
    }
  }

  private handleMarkdownUpdate(markdown: string): void {
    if (this.isUpdatingContent) return
    if (!this.currentTabId || markdown === this.content) return

    this.content = markdown
    this.contentCache.set(this.currentTabId, markdown)

    this.tabsStore.updateTab(this.currentTabId, {
      content: markdown,
      isDirty: true,
      lastModified: Date.now(),
    })

    eventBus.emit(AppEvents.CONTENT_CHANGED, {
      content: markdown,
      tabId: this.currentTabId,
    })
  }

  getMarkdown(): string {
    if (!this.crepe) return this.content
    try {
      return this.crepe.editor.action(getMarkdown()) || this.content
    } catch {
      return this.content
    }
  }

  async setMarkdown(content: string): Promise<void> {
    if (!this.crepe || this.content === content) return

    this.isUpdatingContent = true
    this.content = content

    if (this.currentTabId) {
      this.contentCache.set(this.currentTabId, content)
    }

    try {
      // 使用 ProseMirror Transaction 更新（参考官方实现）
      this.crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const parser = ctx.get(parserCtx)
        const doc = parser(content)

        if (!doc) {
          console.error('[CrepeEditorManager] Failed to parse markdown')
          return
        }

        const state = view.state
        const { from } = state.selection
        let tr = state.tr
        tr = tr.replace(
          0,
          state.doc.content.size,
          new Slice(doc.content, 0, 0)
        )

        const docSize = doc.content.size
        const safeFrom = Math.min(from, docSize - 2)
        tr = tr.setSelection(Selection.near(tr.doc.resolve(safeFrom)))
        view.dispatch(tr)
      })
    } catch (error) {
      console.error('[CrepeEditorManager] Failed to set markdown:', error)
    } finally {
      this.isUpdatingContent = false
    }
  }

  getHTML(): string {
    if (!this.crepe) return ''

    let html = ''
    this.crepe.editor.action((ctx) => {
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

  getViewMode(): ViewMode {
    return this.currentMode
  }

  async switchToTab(tabId: string): Promise<void> {
    const cachedContent = this.contentCache.get(tabId)
    const targetTab = this.tabsStore.tabs.get(tabId)

    if (!targetTab) return

    this.currentTabId = tabId
    const contentToLoad = cachedContent || targetTab.content

    await this.setMarkdown(contentToLoad)
    this.setScrollTop(targetTab.scrollTop)
  }

  setScrollTop(position: number): void {
    // 可以实现滚动位置恢复
  }

  async destroy(): Promise<void> {
    if (this.crepe) {
      await this.crepe.destroy()
      this.crepe = null
    }

    this.contentCache.clear()
    this.content = ''
    this.currentTabId = null
  }

  isReady(): boolean {
    return this.crepe !== null
  }
}

// Composable 函数（参考官方 atom.ts）
export function useCrepeEditorManager() {
  const tabsStore = useTabsStore()
  const containerRef = ref<HTMLElement | null>(null)
  const isReady = ref(false)
  const currentMode = ref<ViewMode>('wysiwyg')

  let manager: CrepeEditorManager | null = null

  const init = async () => {
    if (!containerRef.value || manager) return

    const activeTab = tabsStore.activeTab
    const initialContent = activeTab?.content || ''
    const tabId = activeTab?.id

    currentMode.value = activeTab?.viewMode || 'wysiwyg'

    manager = new CrepeEditorManager(tabsStore)
    await manager.init(containerRef.value, initialContent, tabId)
    isReady.value = manager.isReady()
  }

  const setMarkdown = async (content: string) => {
    await manager?.setMarkdown(content)
  }

  const getMarkdown = () => {
    return manager?.getMarkdown() || ''
  }

  const getHTML = () => {
    return manager?.getHTML() || ''
  }

  const setViewMode = (mode: ViewMode) => {
    currentMode.value = mode
    manager?.setViewMode(mode)
    if (tabsStore.activeTabId) {
      tabsStore.setViewMode(tabsStore.activeTabId, mode)
    }
  }

  const destroy = async () => {
    if (manager) {
      await manager.destroy()
      manager = null
      isReady.value = false
    }
  }

  // 监听标签页切换
  watch(() => tabsStore.activeTabId, async (newTabId, oldTabId) => {
    if (newTabId && newTabId !== oldTabId && manager?.isReady()) {
      await manager.switchToTab(newTabId)
      const tab = tabsStore.tabs.get(newTabId)
      if (tab) {
        currentMode.value = tab.viewMode
      }
    }
  })

  return {
    containerRef,
    isReady,
    currentMode,
    init,
    setMarkdown,
    getMarkdown,
    getHTML,
    setViewMode,
    destroy,
    getManager: () => manager,
  }
}
```

#### 任务 3：重写 EditorContainer.vue

**修改文件：** `src/components/Editor/EditorContainer.vue`

**参考：** `website-main/src/components/playground/index.tsx` 和 `ControlPanel.tsx`

```vue
<template>
  <div class="editor-container">
    <FloatingSearch ref="floatingSearchRef" />

    <!-- 编辑器工具栏 -->
    <div v-if="showEditorToolbar" class="editor-toolbar">
      <div class="toolbar-group">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          class="toolbar-btn"
          :class="{ active: currentMode === mode.value }"
          :title="mode.label"
          @click="handleViewModeChange(mode.value)"
        >
          <Icon :name="mode.icon" size="sm" />
        </button>
      </div>
    </div>

    <!-- 编辑器内容区域 -->
    <div class="editor-content" :class="contentClasses">
      <!-- WYSIWYG 模式 -->
      <div
        v-show="currentMode === EDITOR.VIEW_MODES.WYSIWYG"
        ref="crepeContainer"
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

const crepeContainer = editorManager?.containerRef || ref<HTMLElement | null>(null)
const sourceRef = ref<HTMLTextAreaElement | null>(null)
const splitSourceRef = ref<HTMLTextAreaElement | null>(null)
const splitPreviewRef = ref<HTMLElement | null>(null)
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

const sourceContent = ref('')
const previewHTML = ref('')
const currentMode = editorManager?.currentMode || ref<ViewMode>('wysiwyg')
const showEditorToolbar = ref(false)

const activeTab = computed(() => tabsStore.activeTab)

const contentClasses = computed(() => ({
  [`mode-${currentMode.value}`]: true,
  'typewriter-mode': prefsStore.typewriterMode,
  'focus-mode': prefsStore.focusMode,
}))

const viewModes = [
  { value: EDITOR.VIEW_MODES.WYSIWYG as ViewMode, label: t('editor.wysiwygMode'), icon: 'wysiwyg' },
  { value: EDITOR.VIEW_MODES.SOURCE as ViewMode, label: t('editor.sourceMode'), icon: 'code' },
  { value: EDITOR.VIEW_MODES.SPLIT as ViewMode, label: t('editor.splitMode'), icon: 'split' },
]

// 监听标签页切换
watch(activeTab, (tab) => {
  if (tab) {
    sourceContent.value = tab.content
    updatePreview()
  }
}, { immediate: true })

// 模式切换
const handleViewModeChange = async (mode: ViewMode) => {
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG) {
    sourceContent.value = editorManager?.getMarkdown() || ''
  }

  if (mode === EDITOR.VIEW_MODES.WYSIWYG &&
      currentMode.value !== EDITOR.VIEW_MODES.WYSIWYG) {
    await editorManager?.setMarkdown(sourceContent.value)
  }

  editorManager?.setViewMode(mode)
  updatePreview()
}

// 源码输入处理（参考官方 debounce 200ms）
const handleSourceInput = debounce(() => {
  if (activeTab.value) {
    tabsStore.updateTab(activeTab.value.id, {
      content: sourceContent.value,
      isDirty: true,
    })
    editorManager?.setMarkdown(sourceContent.value)
    updatePreview()
  }
}, 100)

// 更新预览（分屏模式）
function updatePreview() {
  if (currentMode.value === EDITOR.VIEW_MODES.SPLIT) {
    previewHTML.value = editorManager?.getHTML() || ''
  }
}

// Tab 键处理
function handleSourceKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = e.target as HTMLTextAreaElement
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end)
    textarea.selectionStart = textarea.selectionEnd = start + 2
    sourceContent.value = textarea.value
  }
}

// 滚动同步
let isScrollingFromSource = false
let isScrollingFromPreview = false

function handleSourceScroll(e: Event) {
  if (currentMode.value === EDITOR.VIEW_MODES.SPLIT && !isScrollingFromPreview) {
    isScrollingFromSource = true
    const source = e.target as HTMLTextAreaElement
    if (splitPreviewRef.value) {
      const sourceScrollRatio = source.scrollTop / (source.scrollHeight - source.clientHeight || 1)
      splitPreviewRef.value.scrollTop = sourceScrollRatio * (splitPreviewRef.value.scrollHeight - splitPreviewRef.value.clientHeight)
    }
    setTimeout(() => {
      isScrollingFromSource = false
    }, 50)
  }
}

function handlePreviewScroll(e: Event) {
  if (currentMode.value === EDITOR.VIEW_MODES.SPLIT && !isScrollingFromSource) {
    isScrollingFromPreview = true
    const preview = e.target as HTMLElement
    if (splitSourceRef.value) {
      const previewScrollRatio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1)
      splitSourceRef.value.scrollTop = previewScrollRatio * (splitSourceRef.value.scrollHeight - splitSourceRef.value.clientHeight)
    }
    setTimeout(() => {
      isScrollingFromPreview = false
    }, 50)
  }
}

onMounted(async () => {
  if (crepeContainer.value) {
    await editorManager?.init()
  }
  window.addEventListener('keydown', handleEditorKeydown)
})

onUnmounted(async () => {
  await editorManager?.destroy()
  window.removeEventListener('keydown', handleEditorKeydown)
})

function handleEditorKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    floatingSearchRef.value?.show()
  }
}

const { toggleTypewriterMode, toggleFocusMode } = useWritingEnhancement()
</script>

<style scoped lang="scss">
.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--editor-bg);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--border-color);
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 8px;
}

.toolbar-btn {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--toolbar-btn-hover-bg);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}

.editor-content {
  flex: 1;
  overflow: hidden;
  position: relative;

  &.mode-wysiwyg {
    .wysiwyg-editor {
      height: 100%;
      padding: 20px 40px;
      overflow: auto;
      transition: all 0.3s ease;

      :deep(.milkdown) {
        outline: none;
        min-height: 0;
        max-width: 800px;
        margin: 0 auto;
      }
    }
  }

  &.mode-source {
    .source-editor {
      width: 100%;
      height: 100%;
      padding: 20px 40px;
      border: none;
      outline: none;
      resize: none;
      background: var(--editor-bg);
      color: var(--editor-text);
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 14px;
      line-height: 1.6;
    }
  }

  &.mode-split {
    .split-view {
      display: flex;
      height: 100%;

      .split-source {
        width: 50%;
        height: 100%;
        padding: 20px;
        border: none;
        border-right: 1px solid var(--border-color);
        outline: none;
        resize: none;
        background: var(--editor-bg);
        color: var(--editor-text);
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 14px;
        line-height: 1.6;
      }

      .split-preview {
        width: 50%;
        height: 100%;
        padding: 20px;
        overflow: auto;
        background: var(--preview-bg);

        h1, h2, h3 {
          margin: 1em 0 0.5em;
        }

        p {
          margin: 0.5em 0;
        }

        code {
          background: var(--code-bg);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Fira Code', monospace;
        }
      }
    }
  }

  &.typewriter-mode {
    .wysiwyg-editor, .source-editor, .split-source {
      scroll-behavior: smooth;
    }
  }

  &.focus-mode {
    .wysiwyg-editor, .source-editor {
      background: var(--bg-primary);
    }
  }
}
</style>
```

#### 任务 4：更新 App.vue

**修改文件：** `src/App.vue`

```typescript
// 更改导入
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'

// 替换
const { containerRef, isReady, init, setViewMode, destroy, getMarkdown, getHTML, ... } = useCrepeEditorManager()
```

#### 任务 5：更新 clipboard.ts

**修改文件：** `src/services/clipboard.ts`

```typescript
// 更新导入
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'

// 保持原有逻辑，只需要更改导入
```

---

### 阶段二：性能优化（可选）

#### 任务 6：评估是否需要保留 LRU 缓存

Crepe 的 `defaultValue` 会自动处理内容加载，可以评估是否还需要手动缓存。

```typescript
// 如果 Crepe 已经处理了内容缓存，可以考虑简化
// 但是保留 LRU 缓存用于标签页切换优化仍然是合理的
```

#### 任务 7：评估是否需要性能监控

```typescript
// Crepe 已经有内置的状态管理，可以评估是否需要保留 Polling
// 如果需要保留性能监控，可以简化为只监控关键指标
```

---

### 阶段三：清理和验证

#### 任务 8：删除旧文件

```bash
# 删除旧文件
rm src/managers/editorManager.ts
rm src/managers/searchHighlightPlugin.ts
rm src/types/milkdown.d.ts

# 如果有遗留的插件文件也删除
rm -rf src/plugins/  # 如果存在
```

#### 任务 9：类型检查和构建

```bash
# 运行类型检查
npm run typecheck

# 运行构建
npm run build

# 如果有错误，逐个修复
```

#### 任务 10：功能验证清单

**必须验证：**

- [ ] WYSIWYG 模式正常编辑
- [ ] 源码模式显示正确
- [ ] 分屏模式预览正确
- [ ] 模式切换无数据丢失
- [ ] 标签页切换正常
- [ ] 撤销/重做正常
- [ ] 搜索替换正常
- [ ] 复制粘贴正常
- [ ] 导出功能正常
- [ ] 代码块语法高亮正常
- [ ] 图片插入正常
- [ ] 表格编辑正常
- [ [ ] 链接编辑正常
- [ ] Slash 命令菜单正常

---

## 📊 时间估算

| 任务 | 优先级 | 预计时间 |
|------|--------|----------|
| 备份和依赖清理 | P0 | 30min |
| 创建 CrepeEditorManager | P0 | 3h |
| 重写 EditorContainer | P0 | 2h |
| 更新 App.vue | P0 | 30min |
| 更新 clipboard.ts | P0 | 30min |
| 删除旧文件 | P1 | 15min |
| 类型检查和构建 | P0 | 1h |
| 功能验证 | P0 | 2h |

**总预计时间：** ~10小时（分2天完成）

---

## ⚠️ 重要注意事项

1. **完全参考官方实现** - CrepeEditorManager 的实现要严格按照官方 Playground 的模式
2. **Throttle/Debounce** - 官方使用 throttle(200ms) 监听 Crepe，debounce(200ms) 监听 CodeMirror
3. **ProseMirror Transaction** - 使用 `editor.action()` 通过 Transaction 更新内容
4. **无遗留代码** - 每个任务完成后立即删除旧代码
5. **Git 提交** - 每个阶段完成后提交，保持清晰的提交历史

---

## 🎯 执行顺序

1. **任务 1**：备份和依赖清理
2. **任务 2**：创建 CrepeEditorManager（核心）
3. **任务 3**：重写 EditorContainer
4. **任务 4-5**：更新 App.vue 和 clipboard.ts
5. **任务 8**：删除旧文件
6. **任务 9-10**：构建和验证

**立即开始吗？我将按照这个计划逐步执行。**
