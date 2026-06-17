# File Type Registry

> alhagi 是 Markdown 编辑器，其它文件类型属于**辅助功能**，与主编辑链路解耦。这里集中管理所有"文件类型"的识别、加载、渲染、保存策略。

## 加一种新文件类型（步骤 = 写两个文件 + 改一行）

举例：要支持 PDF 预览。

### 1. 写 viewer 组件

`src/fileTypes/viewers/PdfView.vue`（或放别处都行，只是建议同目录）

```vue
<template>
  <div class="pdf-view">
    <!-- 你的 PDF 渲染逻辑。filePath 由 EditorContainer 传入。 -->
  </div>
</template>

<script setup lang="ts">
defineProps<{
  filePath: string | null
  // 如果是可编辑（canSave: true）的 viewer，再加这两个：
  // modelValue: string
}>()

// const emit = defineEmits<{
//   (e: 'update:modelValue', value: string): void
// }>()
</script>
```

约定接口（看你的 descriptor 是 canSave=true 还是 false）：

| 字段 | 类型 | 何时有 |
|---|---|---|
| `filePath` | `string \| null` | 总有 |
| `tabId` | `string` | 总有；用来读写 `tab.viewerState[id]` 持久化私有状态 |
| `modelValue` | `string` | 仅 `canSave=true` |

emits：

| 事件 | 何时 |
|---|---|
| `update:modelValue` | 仅 `canSave=true` 时使用，文档变化触发 |
| `focus` / `blur` | 可选 |

### 2. 写 descriptor

`src/fileTypes/descriptors/pdf.ts`

```ts
import { defineAsyncComponent } from 'vue'
import type { FileTypeDescriptor } from '../registry'

export const pdfDescriptor: FileTypeDescriptor = {
  id: 'pdf',
  displayName: 'PDF',
  extensions: ['.pdf'],
  loadStrategy: 'none',     // PDF 自取 binary，tab.content 留空
  canSave: false,           // 只读
  defaultExtension: '',
  viewer: defineAsyncComponent(() => import('../viewers/PdfView.vue')),
}
```

### 3. 注册

`src/fileTypes/index.ts` 加一行：

```ts
import { pdfDescriptor } from './descriptors/pdf'
// ...
registerFileType(pdfDescriptor)
```

完。

打开 `.pdf` 文件 → 自动识别为 `pdf` 类型 → 渲染 `<PdfView>` 覆盖层 → Crepe 仍在底层但不显示。无需改 EditorContainer / FileExplorer / tabService / detectFileType / validateTabState。

## descriptor 字段速查

| 字段 | 含义 | 例 |
|---|---|---|
| `id` | tab.fileType 字段值，全局唯一 | `'editor'` / `'image'` / `'text'` / `'pdf'` |
| `displayName` | UI 提示用 | `'Markdown'` |
| `extensions` | 扩展名清单（小写、含点号） | `['.md', '.markdown']` |
| `loadStrategy` | `'utf8'` 读 UTF-8 灌 tab.content；`'none'` 不读 | |
| `canSave` | 是否参与 Ctrl+S / 关闭确认 | `true`（markdown/text）/ `false`（image/pdf） |
| `defaultExtension` | "另存为" 默认补的后缀 | `'.md'` / `''` |
| `viewer` | 渲染组件；`null` 走主编辑器外壳 | `defineAsyncComponent(...)` |

## viewer 私有状态（图片 zoom、PDF 页码等）

Viewer 自己用 ref 持有运行期状态即可；如需跨 tab 切换保留 / 持久化到 lastSession，写入 `tab.viewerState[descriptor.id]`：

```ts
const tabsStore = useTabsStore()
tabsStore.updateTab(tabId, {
  viewerState: {
    ...tab.viewerState,
    pdf: { page: 3, zoom: 1.2 },
  },
})
```

`viewerState` 是 `Record<string, unknown>`，按 descriptor.id 命名空间隔离。**必须可 JSON 序列化**（将来要存 lastSession）。

## 设计约束（不要打破）

1. **`'editor'` 必须存在** —— `detectDescriptor(null)` 返回它（欢迎页用）。
2. **必须有且只有一个 `isFallback` descriptor** —— 当前是 `unsupported`。任何未匹配的扩展名落到这里。
3. **扩展名不能跨 descriptor 重复**。`registerFileType` 会在重复时抛错。
4. **viewer 组件用 `defineAsyncComponent`** —— 让首屏不被所有 viewer 拖累。markdown 主编辑器不是 viewer（它的 descriptor.viewer=null），由 EditorContainer 直接渲染。

## 不变量回顾（与 [[alhagi-auxiliary-features]] 对齐）

- 主编辑器外壳（Crepe + CodeMirror）始终保留在 DOM 中（`v-show`），辅助 viewer 用绝对定位**覆盖层**（`v-if`）盖在上面。
- 切到辅助 tab 时，Crepe 实例不被销毁。
- `editorManager.switchToTab` 只对 `tab.fileType === 'editor'` 触发，避免乱码灌进 markdown 解析器。
