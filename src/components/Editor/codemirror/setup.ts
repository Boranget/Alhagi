import type { Extension } from '@codemirror/state'
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
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
  LanguageDescription,
} from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
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
import { debounce } from '@/utils/helpers'

const basicSetup: Extension = [
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...completionKeymap,
  ]),
]

/**
 * CodeMirror ViewPlugin: 检测文档开头的 YAML frontmatter 并添加装饰样式。
 *
 * 在源码编辑模式下，frontmatter 以原始 `---\n...\n---` 格式显示。
 * 本插件检测该区域并应用灰色半透明样式，使其在视觉上与正文区分。
 */
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

    // 检查文档是否以 frontmatter 开头
    const text = doc.sliceString(0, Math.min(doc.length, 500))
    const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---/)

    if (fmMatch) {
      const fmEnd = fmMatch[0].length

      // 为整个 frontmatter 区域添加 line decoration（灰色背景样式）
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
}

export const createCodeMirrorState = ({
  onChange,
  content,
  onFocus,
  onBlur,
  onSelectionChange,
}: StateOptions) => {
  return EditorState.create({
    doc: content,
    extensions: [
      basicSetup,
      markdown({
        // 注册 YAML 语言支持，使 ```yaml 代码块有语法高亮
        codeLanguages: [
          LanguageDescription.of({
            name: 'yaml',
            support: yaml(),
          }),
        ],
      }),
      // Frontmatter 高亮插件
      frontmatterHighlighter,
      EditorView.updateListener.of((viewUpdate) => {
        if (viewUpdate.focusChanged) {
          if (viewUpdate.view.hasFocus) {
            onFocus?.()
          } else {
            onBlur?.()
          }
        }
        
        onCodeMirrorUpdate(onChange, viewUpdate)
        
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
  200
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
