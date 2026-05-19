# 分屏模式和源代码模式亮暗色切换优化

## 概述

本次优化参考了 Milkdown 官方 website 项目的 playground 实现，改进了我们项目中分屏模式和源代码模式的亮暗色主题切换功能。

## 主要改进

### 1. CodeMirrorEditor 组件优化

**文件**: `src/components/Editor/CodeMirrorEditor.vue`

#### 改进前
- 通过 props 接收 `dark` 参数
- 需要父组件手动传递暗色模式状态
- 主题变化时依赖外部触发

#### 改进后
- 自动从 preferences store 获取主题状态
- 使用计算属性 `isDarkMode` 动态判断当前主题
- 支持 `light`、`dark`、`system` 三种主题模式
- 监听主题变化自动重新创建编辑器实例

```typescript
const isDarkMode = computed(() => {
  if (prefsStore.theme === 'dark') return true
  if (prefsStore.theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  }
  return false
})

watch(isDarkMode, () => {
  destroyEditor()
  initEditor()
})
```

### 2. 系统主题监听

**文件**: `src/App.vue`

添加了系统主题变化的监听器，当用户操作系统级别的亮暗色设置时，应用能够自动响应（仅在主题设置为 `system` 时）。

```typescript
function setupSystemThemeListener() {
  systemThemeListener = async (e: MediaQueryListEvent) => {
    if (prefsStore.theme === 'system') {
      console.log('[App] System theme changed:', e.matches ? 'dark' : 'light')
      prefsStore.applyTheme()
      await editorManager.updateTheme()
    }
  }
  
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', systemThemeListener)
}
```

### 3. Crepe 编辑器主题更新

**文件**: `src/managers/crepeEditorManager.ts`

优化了 `updateTheme()` 方法，确保在主题切换时正确保存和恢复编辑器状态。

## 工作原理

### 主题切换流程

1. **用户操作触发**
   - 用户点击状态栏的主题切换按钮
   - 或操作系统主题发生变化

2. **Preferences Store 更新**
   - `toggleLightDark()` 或 `applyTheme()` 被调用
   - 更新 `theme` 值并保存到 localStorage

3. **Vue Watcher 响应**
   - App.vue 中的 watcher 检测到主题变化
   - 调用 `prefsStore.applyTheme()` 更新 DOM
   - 调用 `editorManager.updateTheme()` 更新编辑器

4. **编辑器重建**
   - Crepe 编辑器：销毁旧实例，用新主题配置重新创建
   - CodeMirror 编辑器：通过 `isDarkMode` 计算属性变化触发重建

5. **系统主题监听**
   - 如果主题为 `system`，监听器会检测系统主题变化
   - 自动触发上述流程

### 主题模式说明

- **light**: 始终使用浅色主题
- **dark**: 始终使用深色主题
- **system**: 跟随操作系统主题设置

## 测试建议

### 手动测试步骤

1. **测试亮暗色切换**
   - 打开任意 Markdown 文件
   - 切换到源代码模式或分屏模式
   - 点击状态栏的月亮/太阳图标
   - 验证 CodeMirror 编辑器主题是否正确切换

2. **测试系统主题跟随**
   - 在设置中将主题设置为 "System"
   - 改变操作系统的亮暗色设置
   - 验证应用是否自动跟随系统主题变化

3. **测试不同视图模式**
   - 在 WYSIWYG、Source、Split 三种模式间切换
   - 每种模式下测试主题切换
   - 验证所有编辑器都正确响应主题变化

4. **测试状态保持**
   - 在编辑器中输入一些内容
   - 切换主题
   - 验证内容和光标位置是否正确保持

## 技术细节

### CodeMirror 主题

- **浅色模式**: 使用 `@uiw/codemirror-theme-eclipse`
- **深色模式**: 使用 `@uiw/codemirror-theme-nord`

### Crepe 主题配置

```typescript
featureConfigs: {
  [Crepe.Feature.CodeMirror]: {
    theme: isDark ? undefined : eclipse,
  },
}
```

注意：Crepe 在深色模式下使用默认主题（undefined），在浅色模式下使用 Eclipse 主题。

### 性能考虑

主题切换时会销毁并重新创建编辑器实例，这是一个相对重量级的操作。但由于主题切换不是频繁操作，这种实现方式是可以接受的。

## 与 Website Playground 的对比

| 特性 | Website Playground | 我们的实现 |
|------|-------------------|-----------|
| 状态管理 | Jotai atoms | Pinia store |
| 主题检测 | useDarkMode hook | computed property |
| 同步机制 | focus lock | activeEditor flag |
| 系统主题监听 | ✓ | ✓ |
| 动态加载 | Next.js dynamic | N/A (Electron app) |

## 未来改进方向

1. **平滑过渡动画**: 添加主题切换时的过渡动画
2. **主题缓存**: 缓存编辑器实例以减少重建开销
3. **更多主题选项**: 支持用户自定义主题
4. **性能优化**: 探索增量主题更新而非完全重建

## 相关文件

- `src/components/Editor/CodeMirrorEditor.vue`
- `src/components/Editor/EditorContainer.vue`
- `src/managers/crepeEditorManager.ts`
- `src/stores/preferences.ts`
- `src/App.vue`
- `src/styles/variables.scss`
