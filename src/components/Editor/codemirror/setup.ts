import type { Extension } from '@codemirror/state'
import { Annotation, Compartment } from '@codemirror/state'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import {
  bracketMatching,
  indentOnInput,
  LanguageDescription,
} from '@codemirror/language'
import { highlightSelectionMatches, search } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewUpdate,
  ViewPlugin,
  crosshairCursor,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
} from '@codemirror/view'
import { githubLight } from '@uiw/codemirror-theme-github'
import { githubDark } from '@uiw/codemirror-theme-github'
import { debounce } from '@/utils/helpers'
import { codeMirrorSearchHighlight } from '@/services/search'

export type ThemeType = 'dark' | 'light'

/** CodeMirror 内容更新防抖延迟 */
const CODEMIRROR_UPDATE_DEBOUNCE_MS = 200

const themeCompartment = new Compartment()
const typographyCompartment = new Compartment()

/**
 * Transaction 标注：标记由"外部 modelValue 同步"驱动的 dispatch
 * （切 tab、saveAs、其它窗口同步等），与"用户在编辑器里敲键盘"区分开。
 *
 * 配合 EditorView.updateListener 检查：带此标注的 transaction
 * 不再调用 onChange，避免把外部输入当用户编辑触发 isDirty。
 *
 * 跟 PlainTextEditor 内部那个 ExternalChange 是同义物（PlainTextEditor 不依赖
 * setup.ts，自己定义了一份）。两者做完全一样的事。
 */
export const ExternalChange = Annotation.define<boolean>()

/**
 * 获取主题扩展
 * 使用官方主题包：githubLight（亮色）和 githubDark（暗色）
 */
function getThemeExtension(theme: ThemeType): Extension {
  return theme === 'dark' ? githubDark : githubLight
}

function getTypographyExtension(): Extension {
  return EditorView.theme({
    '.cm-scroller': {
      fontSize: 'var(--alhagi-source-font-size)',
      lineHeight: 'var(--alhagi-source-line-height)',
    },
  })
}

export function getThemeExtensions(theme: ThemeType): Extension[] {
  return [
    themeCompartment.of(getThemeExtension(theme)),
    typographyCompartment.of(getTypographyExtension()),
  ]
}

export function updateEditorTypography(view: EditorView): void {
  view.dispatch({
    effects: typographyCompartment.reconfigure(getTypographyExtension()),
  })
}

/**
 * 使用官方 API 动态切换主题
 * @param view - 编辑器视图
 * @param theme - 主题类型
 */
export function updateEditorTheme(view: EditorView, theme: ThemeType): void {
  view.dispatch({
    effects: [
      themeCompartment.reconfigure(getThemeExtension(theme)),
    ],
  })
}

const basicSetup: Extension = [
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  search(),
  codeMirrorSearchHighlight(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...historyKeymap,
    ...completionKeymap,
  ]),
]

const frontmatterHighlighter = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const decorations: { from: number; to: number }[] = []
    const doc = view.state.doc

    const text = doc.sliceString(0, Math.min(doc.length, 500))
    const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---/)

    if (fmMatch) {
      const fmEnd = fmMatch[0].length

      for (let i = 1; i <= doc.lineAt(fmEnd - 1).number; i++) {
        const line = doc.line(i)
        decorations.push({ from: line.from, to: line.from })
      }
    }

    if (decorations.length === 0) {
      return Decoration.none
    }

    const lineDeco = Decoration.line({ class: 'cm-frontmatter-line' })
    const rangeSet = decorations.map(d =>
      lineDeco.range(d.from, d.to)
    )
    return Decoration.set(rangeSet, true)
  }
}, {
  decorations: v => v.decorations,
})

interface StateOptions {
  onChange: (getString: () => string) => void
  onFocus?: () => void
  onBlur?: () => void
  onSelectionChange?: () => void
  content: string
  theme?: ThemeType
}

export const createCodeMirrorState = ({
  onChange,
  content,
  onFocus,
  onBlur,
  onSelectionChange,
  theme = 'dark',
}: StateOptions) => {
  return EditorState.create({
    doc: content,
    extensions: [
      basicSetup,
      ...getThemeExtensions(theme),
      markdown({
        codeLanguages: [
          LanguageDescription.of({
            name: 'yaml',
            support: yaml(),
          }),
        ],
      }),
      frontmatterHighlighter,
      EditorView.updateListener.of((viewUpdate) => {
        if (viewUpdate.focusChanged) {
          if (viewUpdate.view.hasFocus) {
            onFocus?.()
          } else {
            onBlur?.()
          }
        }

        // 仅在文档真正变化时通知外部 onChange。
        // 否则点击 / 滚动 / 仅 selection 变化等"非编辑"update 也会被当成
        // 内容修改，导致父组件错误地标记 tab.isDirty。
        // 同时跳过带 ExternalChange 标注的 transaction —— 那是"切 tab 等外部
        // 同步"产生的 doc 替换，不是用户编辑。
        if (viewUpdate.docChanged) {
          const fromExternal = viewUpdate.transactions.some(
            (tr) => tr.annotation(ExternalChange) === true,
          )
          if (!fromExternal) {
            onCodeMirrorUpdate(onChange, viewUpdate)
          }
        }

        if (onSelectionChange && viewUpdate.selectionSet) {
          onSelectionChange()
        }
      }),
    ],
  })
}

const onCodeMirrorUpdate = debounce(
  (...args: unknown[]) => {
    const onChange = args[0] as (getString: () => string) => void
    const viewUpdate = args[1] as ViewUpdate
    if (!viewUpdate.view.hasFocus) {
      return
    }
    const getString = () => viewUpdate.state.doc.toString()
    onChange(getString)
  },
  CODEMIRROR_UPDATE_DEBOUNCE_MS
)

interface ViewOptions extends StateOptions {
  root: HTMLElement
}

export const createCodeMirrorView = ({ root, ...options }: ViewOptions) => {
  return new EditorView({
    state: createCodeMirrorState(options),
    parent: root,
  })
}

export { EditorView }