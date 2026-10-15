// ============================================================
// useCmDocumentView —— CodeMirror 文档视图的公共底座
// ============================================================
//
// 所有"单文档、单视图"的 CM 编辑器（纯文本 / 未来的代码高亮等）共用这份底座：
//   EditorView 生命周期 · 主题 compartment · 搜索服务 ·
//   外部同步标注（ExternalChange）· 用户编辑上报（严格 docChanged 过滤）
//
// 与 markdown 源码模式（setup.ts）的边界：
//   setup.ts 是 markdown 专属（lang-markdown / frontmatter / 自动补全 / 防抖 onChange），
//   服务于 Crepe+CM 双投影同步的复杂场景，不走本底座。
//   本底座是"干净的文档编辑器"最小集，不带任何 markdown 假设。
//
// 消费者通过 options.extensions 叠加自己的语言包 / 高亮扩展，
// 主题、按键、搜索等基础设施无需各自再写一遍。
//
// 见 [[alhagi-auxiliary-features]] / fileTypes README。

import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { search } from '@codemirror/search'
import {
  EditorView,
  crosshairCursor,
  dropCursor,
  drawSelection,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
} from '@codemirror/view'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import { usePreferencesStore } from '@/stores/preferences'
import { CodeMirrorSearchService, codeMirrorSearchHighlight } from '@/services/search'
import { ExternalChange, type ThemeType } from './shared'

export interface CmDocumentViewOptions {
  /**
   * 用户编辑（非外部同步）导致文档变化时回调。
   * 带 ExternalChange 标注的外部同步不会触发——调用方无需自己过滤。
   */
  onUserChange?: (content: string) => void
  onFocus?: () => void
  onBlur?: () => void
  /**
   * 额外扩展（语言包、专属高亮等）。
   * 主题 / 按键 / 搜索 / 基础高亮已由底座提供，消费方只补自己独有的部分。
   */
  extensions?: () => Extension[]
}

export function useCmDocumentView(options: CmDocumentViewOptions = {}) {
  const prefsStore = usePreferencesStore()
  const { theme } = storeToRefs(prefsStore)

  const editorRef = ref<HTMLElement | null>(null)
  let view: EditorView | null = null
  const searchManager = new CodeMirrorSearchService(() => view)
  const themeCompartment = new Compartment()

  const isDark = computed<ThemeType>(() => {
    if (theme.value === 'dark') return 'dark'
    if (theme.value === 'system') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  function getThemeExtension(): Extension {
    return isDark.value === 'dark' ? githubDark : githubLight
  }

  function buildExtensions(): Extension[] {
    return [
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      search(),
      codeMirrorSearchHighlight(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      themeCompartment.of(getThemeExtension()),
      ...(options.extensions?.() ?? []),
      EditorView.updateListener.of((update) => {
        if (update.focusChanged) {
          if (update.view.hasFocus) options.onFocus?.()
          else options.onBlur?.()
        }
        if (update.docChanged) {
          const fromExternal = update.transactions.some(
            (tr) => tr.annotation(ExternalChange) === true,
          )
          if (!fromExternal) {
            options.onUserChange?.(update.state.doc.toString())
          }
        }
      }),
    ]
  }

  /**
   * 创建视图。editorRef 未就绪或视图已存在时安全返回。
   * 消费方在 onMounted 里调用。
   */
  function createView(initialContent: string): EditorView | null {
    if (view || !editorRef.value) return view
    view = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: buildExtensions(),
      }),
      parent: editorRef.value,
    })
    return view
  }

  /**
   * 销毁视图（清搜索高亮 → destroy）。
   * 消费方负责在 onUnmounted 里先做自己的持久化，再调本方法。
   */
  function destroyView(): void {
    if (!view) return
    searchManager.clear()
    view.destroy()
    view = null
  }

  /**
   * 外部内容同步（切 tab / saveAs / 其它窗口同步）。
   * 带 ExternalChange 标注——不会触发 onUserChange（不误标 isDirty）。
   * 当前内容与目标一致时直接返回，不产生多余 transaction。
   */
  function syncContent(content: string): void {
    if (!view) return
    const cur = view.state.doc.toString()
    if (cur === content) return
    view.dispatch({
      changes: { from: 0, to: cur.length, insert: content },
      annotations: ExternalChange.of(true),
    })
  }

  // 主题动态切换：仅当视图已创建时 reconfigure
  watch(isDark, () => {
    if (!view) return
    view.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtension()),
    })
  })

  return {
    editorRef,
    createView,
    destroyView,
    syncContent,
    getView: () => view,
    searchManager,
  }
}
