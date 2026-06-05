/**
 * Crepe CodeMirror 主题配置
 * 
 * 提供亮色/暗色主题的 CodeMirror 扩展，
 * 用于 CustomCodeMirrorBlock 的动态主题切换。
 */

import type { Extension } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'

/**
 * 亮色主题的 CodeMirror 扩展
 * 使用 CodeMirror 默认的亮色主题
 */
function lightTheme(): Extension {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: '#ffffff',
        color: '#1e1e1e',
      },
      '.cm-content': {
        caretColor: '#1e1e1e',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: '#1e1e1e',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
        {
          backgroundColor: '#add6ff',
        },
      '.cm-activeLine': {
        backgroundColor: '#f5f5f5',
      },
      '.cm-gutters': {
        backgroundColor: '#fafafa',
        color: '#6e7681',
        border: 'none',
      },
    },
    { dark: false }
  )
}

/**
 * 暗色主题的 CodeMirror 扩展
 * 使用 @codemirror/theme-one-dark
 */
function darkTheme(): Extension {
  return [
    oneDark,
    EditorView.theme(
      {
        '.cm-activeLine': {
          backgroundColor: '#2c313a',
        },
        '.cm-gutters': {
          backgroundColor: '#282c34',
          color: '#636d83',
          border: 'none',
        },
      },
      { dark: true }
    ),
  ]
}

/**
 * 获取 CodeMirror 主题扩展
 * 
 * @param theme - 主题名称，'light' 或 'dark'
 * @returns CodeMirror 主题扩展
 */
export function getCrepeCodeMirrorTheme(theme: 'light' | 'dark'): Extension {
  return theme === 'dark' ? darkTheme() : lightTheme()
}
