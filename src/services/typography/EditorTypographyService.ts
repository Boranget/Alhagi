/**
 * 编辑器排版服务
 *
 * 把 preferences store 里的字体/行高数值，运行时同步到全局 CSS 变量：
 *   --alhagi-editor-font-size      / --alhagi-editor-line-height
 *      ↑ Crepe wysiwyg 编辑器（段落/标题/列表 + Crepe 内嵌 CodeMirror 代码块）
 *   --alhagi-source-font-size      / --alhagi-source-line-height
 *      ↑ 源码模式（独立 CodeMirror 实例）
 *
 * 两组变量解耦：用户可以让 wysiwyg 阅读字号大、源码模式字号小（或反之）。
 *
 * 为什么 wysiwyg 走 CSS 变量：
 *   Milkdown / Crepe 没有官方运行时排版 API，仅暴露三个 font-family CSS
 *   变量；size / line-height 在 reset.css 里写死。我们用同样具体的选择器
 *   覆盖之（详见 main.scss）。
 *
 * 为什么源码模式同样走 CSS 变量而不是 EditorView.theme()：
 *   CodeMirror 的 baseTheme 注入了 `.cm-scroller { line-height: 1.4 }`，
 *   普通 CSS 选择器（包括 `:deep(.cm-content)`）特异性比 baseTheme 低，
 *   单纯用 CSS 变量覆盖必须配合 inline style 或 `EditorView.theme()`。
 *   方案：CodeMirrorEditor.vue 用 Compartment 注入一个读 CSS 变量的
 *   themeExtension —— 见 codemirror/setup.ts。本 service 仅负责把数值
 *   写到 :root 变量。
 *
 * 关键设计：service 全局只装载一次（在 App 启动入口调用 setupEditorTypography）。
 *   pinia store 的 ref 是单例，watchEffect 也跟随当前 effect scope，重复调用
 *   会产生多个 watcher。
 */

import { watchEffect } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'

const VARS = {
  editorFontSize: '--alhagi-editor-font-size',
  editorLineHeight: '--alhagi-editor-line-height',
  sourceFontSize: '--alhagi-source-font-size',
  sourceLineHeight: '--alhagi-source-line-height',
} as const

/**
 * 在应用启动时调用一次，把 preferences 的字体/行高同步到 :root CSS 变量。
 * 之后 store 任何变更都自动反映 —— 不需要用户做额外动作。
 */
export function setupEditorTypography(): void {
  const prefs = usePreferencesStore()
  const root = document.documentElement

  watchEffect(() => {
    root.style.setProperty(VARS.editorFontSize, `${prefs.fontSize}px`)
    root.style.setProperty(VARS.editorLineHeight, String(prefs.lineHeight))
    root.style.setProperty(VARS.sourceFontSize, `${prefs.sourceFontSize}px`)
    root.style.setProperty(VARS.sourceLineHeight, String(prefs.sourceLineHeight))
  })
}
