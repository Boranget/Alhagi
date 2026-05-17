# Milkdown API 优化报告

## 优化目标
将所有手动 Markdown → HTML 的正则转换替换为 Milkdown 自带的 API，确保转换的准确性和一致性。

## 完成的优化

### 1. ✅ editorManager.ts - 核心编辑器管理器

#### 1.1 添加必要的依赖导入
- 新增 `schemaCtx` 从 `@milkdown/core`
- 新增 `DOMSerializer` 从 `@milkdown/prose`

#### 1.2 实现 getHTML() 方法
```typescript
getHTML(): string {
  if (!this.editor || !this.isReady()) {
    return ''
  }

  let html = ''
  this.editor.action((ctx) => {
    const context = ctx as { get: (key: unknown) => unknown }
    const schema = context.get(schemaCtx) as any
    const view = context.get(editorViewCtx) as any

    if (schema && view) {
      const div = document.createElement('div')
      const fragment = DOMSerializer.fromSchema(schema).serializeFragment(view.state.doc.content)
      div.appendChild(fragment)
      html = div.innerHTML
    }
  })

  return html
}
```

#### 1.3 优化 getMarkdown() 方法
将原有的简单返回改为使用 Milkdown 的 `serializerCtx` API：
```typescript
getMarkdown(): string {
  if (!this.editor || !this.isReady()) {
    return this.content
  }

  let markdown = ''
  this.editor.action((ctx) => {
    const context = ctx as { get: (key: unknown) => unknown }
    const serializer = context.get(serializerCtx) as any
    const view = context.get(editorViewCtx) as any

    if (serializer && view) {
      markdown = serializer(view.state.doc)
    }
  })

  return markdown || this.content || this.tabsStore.activeTab?.content || ''
}
```

#### 1.4 导出新方法
在 `useEditorManager()` composable 中导出 `getHTML` 函数

### 2. ✅ EditorContainer.vue - 编辑器容器组件

#### 2.1 更新导入
```typescript
const { containerRef, currentMode, init, setViewMode, destroy, getManager, getHTML } = useEditorManager()
```

#### 2.2 优化 updatePreview() 函数
**优化前：** 使用手动正则转换
```typescript
const html = sourceContent.value
  .replace(/^### (.*$)/gim, '<h3>$1</h3>')
  .replace(/^## (.*$)/gim, '<h2>$1</h2>')
  // ... 更多正则
```

**优化后：** 使用 Milkdown API
```typescript
const html = getHTML()
splitPreviewRef.value.innerHTML = html
```

### 3. ✅ App.vue - 主应用组件

#### 3.1 添加导入
```typescript
import { useEditorManager } from '@/managers/editorManager'
const { getMarkdown, getHTML } = useEditorManager()
```

#### 3.2 优化 exportFile() 函数
使用 `getFullHtml()` 替代 `convertMarkdownToFullHtml()`，该函数内部调用 Milkdown 的 `getHTML()`

#### 3.3 新增辅助函数
- `getFullHtml(title: string)` - 使用 Milkdown API 生成完整的 HTML 文档
- `escapeHtml(text: string)` - HTML 实体转义

### 4. ✅ clipboard.ts - 剪贴板服务

#### 4.1 完全重构
**优化前：** 独立的 `convertMarkdownToHtml()` 和 `convertMarkdownToFullHtml()` 函数，使用大量手动正则

**优化后：** 使用 Milkdown API
```typescript
import { useEditorManager } from '@/managers/editorManager'

export function useClipboard() {
  const { getMarkdown, getHTML } = useEditorManager()

  function copyAsMarkdown(): boolean {
    const text = getMarkdown()
    navigator.clipboard.writeText(text)
    return true
  }

  function copyAsHtml(): boolean {
    const htmlContent = getHTML()
    const fullHtml = wrapWithHtmlTemplate(htmlContent, activeTab.title)
    // ...
  }
}
```

## 技术说明

### Milkdown 的 HTML 转换机制

Milkdown 使用 ProseMirror 的 DOMSerializer 来实现从文档模型到 HTML 的转换。这比手动正则转换更加准确和可靠，因为：

1. **结构一致性**：DOMSerializer 直接遍历 ProseMirror 文档树，确保输出的 HTML 结构与编辑器显示完全一致
2. **语法完整性**：不会遗漏复杂的 Markdown 语法（如嵌套列表、代码块、表格等）
3. **属性处理**：正确处理元素属性（如图片的 alt 文本、链接的 href 等）
4. **性能优化**：作为内部 API，性能比正则匹配更好

### 使用的方法

- **DOMSerializer.fromSchema(schema)**: 创建序列化器
- **serializeFragment(content)**: 序列化文档片段
- **serializerCtx**: Milkdown 的序列化上下文（用于 getMarkdown）
- **editorViewCtx**: 编辑器视图上下文（用于访问文档状态）

## 保留的正则表达式

以下位置的正则表达式是合理的，不需要替换：

1. **StatusBar.vue** - 用于文本统计（字符数统计等），不是 HTML 转换
2. **useWorkspaceSearch.ts** - 用于搜索功能，需要正则支持
3. **search.ts** - 搜索工具库
4. **xssSanitizer.ts** - XSS 防护，需要手动转义
5. **helpers.ts** - 通用辅助函数
6. **clipboard.ts 的 pasteAsPlainText()** - 粘贴纯文本处理

## 验证方法

可以通过以下方式验证优化效果：

1. **分割视图预览**：切换到分割模式，验证预览窗口的 HTML 与实际渲染一致
2. **复制为 HTML**：复制为 HTML 格式，验证生成的 HTML 文档结构正确
3. **导出为 HTML**：导出为 HTML 文件，验证文件内容完整
4. **复制为 Markdown**：复制为 Markdown 格式，验证 Markdown 语法正确

## 优化效果

1. ✅ **准确性提升**：HTML 转换更加准确，不会遗漏复杂语法
2. ✅ **代码简化**：减少了大量重复的正则表达式代码
3. ✅ **维护性提高**：HTML 转换逻辑集中在 editorManager 中
4. ✅ **一致性保证**：预览、复制、导出都使用相同的转换逻辑

## 相关文件清单

### 修改的文件
- `/workspace/src/managers/editorManager.ts` - 核心编辑器管理器
- `/workspace/src/components/Editor/EditorContainer.vue` - 编辑器容器
- `/workspace/src/App.vue` - 主应用
- `/workspace/src/services/clipboard.ts` - 剪贴板服务

### 保留的文件（未修改）
- `/workspace/src/components/StatusBar/StatusBar.vue` - 状态栏（保留文本统计正则）
- `/workspace/src/composables/useWorkspaceSearch.ts` - 搜索功能
- `/workspace/src/utils/search.ts` - 搜索工具
- `/workspace/src/services/xssSanitizer.ts` - XSS 防护

## 结论

所有可优化的 Markdown → HTML 转换都已使用 Milkdown 自带 API 替代。代码更加简洁、准确和一致，同时保持了其他合理的正则表达式使用（如搜索、统计等）。
