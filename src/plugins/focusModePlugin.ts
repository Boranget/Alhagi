import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

const FOCUS_MODE_ACTIVE_CLASS = 'focus-highlight'

/** 插件 key，用于外部控制 focus mode 开关 */
export const focusModePluginKey = new PluginKey('focus-mode')

interface FocusModeState {
  enabled: boolean
  /** 当前活跃块的 start/end，用于判断光标是否在同一块内 */
  activeStart: number
  activeEnd: number
}

/**
 * 专注模式 ProseMirror 插件
 *
 * 通过 Decoration 给光标所在的顶层块添加 .focus-highlight class，
 * CSS 用此 class 恢复活跃块的 opacity。
 *
 * 外部通过 meta 控制开关：
 *   view.dispatch(view.state.tr.setMeta(focusModePluginKey, { enabled: true }))
 */
export const focusModePlugin = $prose(() => {
  return new Plugin<FocusModeState>({
    key: focusModePluginKey,
    state: {
      init(): FocusModeState {
        return { enabled: false, activeStart: -1, activeEnd: -1 }
      },
      apply(tr, value) {
        // 处理外部开关 meta
        const meta = tr.getMeta(focusModePluginKey)
        if (meta) {
          return {
            ...value,
            enabled: meta.enabled,
            activeStart: -1,
            activeEnd: -1,
          }
        }

        // focus mode 关闭时跳过
        if (!value.enabled) return value

        // 无变化时跳过
        if (!tr.docChanged && !tr.selectionSet) return value

        const { $from } = tr.selection
        const start = $from.before(1)
        const end = $from.after(1)

        // 光标在同一块内且文档未变 → 复用旧 state，不重建 DecorationSet
        if (!tr.docChanged && start === value.activeStart && end === value.activeEnd) {
          return value
        }

        return { enabled: true, activeStart: start, activeEnd: end }
      },
    },
    props: {
      decorations(state) {
        const pluginState = this.getState(state)
        if (!pluginState?.enabled) return DecorationSet.empty

        const { $from } = state.selection
        const start = $from.before(1)
        const end = $from.after(1)

        return DecorationSet.create(state.doc, [
          Decoration.node(start, end, { class: FOCUS_MODE_ACTIVE_CLASS }),
        ])
      },
    },
  })
})
