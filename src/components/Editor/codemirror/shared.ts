// CM 文档视图各实现（markdown 源码模式 setup.ts / 纯文本 useCmDocumentView）
// 共享的最小公共件：单一定义放这里，避免各实现各抄一份。
import { Annotation } from '@codemirror/state'

export type ThemeType = 'dark' | 'light'

/**
 * Transaction 标注：标记由"外部 modelValue 同步"驱动的 dispatch
 * （切 tab、saveAs、其它窗口同步等），与"用户在编辑器里敲键盘"区分开。
 *
 * 配合 EditorView.updateListener 检查：带此标注的 transaction
 * 不再当作用户编辑上报，避免误标 isDirty。
 */
export const ExternalChange = Annotation.define<boolean>()
