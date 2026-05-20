import type { Extension } from '@codemirror/state'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  ViewUpdate,
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

// 使用 Compartment 实现原地主题切换，避免销毁重建编辑器
const themeCompartment = new Compartment()

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

interface StateOptions {
  dark: boolean
  onChange: (getString: () => string) => void
  onFocus?: () => void
  content: string
}

export const createCodeMirrorState = ({
  onChange,
  content,
  dark,
  onFocus,
}: StateOptions) => {
  return EditorState.create({
    doc: content,
    extensions: [
      themeCompartment.of(dark ? nord : eclipse),
      basicSetup,
      markdown(),
      EditorView.updateListener.of((viewUpdate) => {
        onCodeMirrorUpdate(onChange, viewUpdate)
      }),
      onFocus ? EditorView.domEventHandlers({ focus: onFocus }) : [],
    ],
  })
}

/** 原地切换 CodeMirror 主题，无需销毁重建编辑器实例 */
export function reconfigureTheme(editorView: EditorView, dark: boolean): void {
  editorView.dispatch({
    effects: themeCompartment.reconfigure(dark ? nord : eclipse),
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
