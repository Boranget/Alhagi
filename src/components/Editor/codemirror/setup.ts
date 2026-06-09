import type { Extension } from '@codemirror/state'
import { Compartment } from '@codemirror/state'
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
import { eclipse } from '@uiw/codemirror-theme-eclipse'
import { nord } from '@uiw/codemirror-theme-nord'
import { debounce } from '@/utils/helpers'

export type ThemeType = 'dark' | 'light'

const themeCompartment = new Compartment()

/**
 * 获取主题扩展
 * 使用官方主题包：eclipse（亮色）和 nord（暗色）
 */
function getThemeExtension(theme: ThemeType): Extension {
  return theme === 'dark' ? nord : eclipse
}

export function getThemeExtensions(theme: ThemeType): Extension[] {
  return [themeCompartment.of(getThemeExtension(theme))]
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
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
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

export { EditorView }