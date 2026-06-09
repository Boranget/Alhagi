/**
 * Crepe CodeMirror 主题配置
 * 
 * 提供亮色/暗色主题的 CodeMirror 扩展，
 * 用于 CustomCodeMirrorBlock 的动态主题切换。
 */

import type { Extension } from '@codemirror/state'
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import { nord } from '@uiw/codemirror-theme-nord'

/**
 * 获取 CodeMirror 主题扩展
 * 
 * @param theme - 主题名称，'light' 或 'dark'
 * @returns CodeMirror 主题扩展
 */
export function getCrepeCodeMirrorTheme(theme: 'light' | 'dark'): Extension {
  return theme === 'dark' ? nord : eclipse
}
