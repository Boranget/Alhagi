import type { Extension } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
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
  HighlightStyle,
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
import { tags } from '@lezer/highlight'
import { debounce } from '@/utils/helpers'

export type ThemeType = 'dark' | 'light'

const darkBaseTheme = EditorView.theme({
  '&': {
    backgroundColor: '#2e3440',
    color: '#d8dee9',
  },
  '.cm-content': {
    caretColor: '#d8dee9',
  },
  '.cm-cursor': {
    borderLeftColor: '#d8dee9',
  },
  '.cm-dropCursor': {
    borderLeftColor: '#d8dee9',
  },
  '.cm-gutters': {
    backgroundColor: '#2e3440',
    color: '#4c566a',
    borderRightColor: '#2e3440',
  },
  '.cm-activeLineGutter': {
    color: '#d8dee9',
    backgroundColor: '#4c566a29',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#00000073',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#00000073',
  },
  '.cm-activeLine': {
    backgroundColor: '#4c566a29',
  },
})

const lightBaseTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  '.cm-content': {
    caretColor: '#000000',
  },
  '.cm-cursor': {
    borderLeftColor: '#000000',
  },
  '.cm-dropCursor': {
    borderLeftColor: '#000000',
  },
  '.cm-gutters': {
    backgroundColor: '#f7f7f7',
    color: '#999999',
    borderRightColor: 'transparent',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#006fff1c',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#d7d4f0',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#d7d4f0',
  },
  '.cm-activeLine': {
    backgroundColor: '#006fff1c',
  },
})

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#5e81ac' },
  { tag: tags.name, color: '#88c0d0' },
  { tag: tags.deleted, color: '#88c0d0' },
  { tag: tags.character, color: '#88c0d0' },
  { tag: tags.propertyName, color: '#88c0d0' },
  { tag: tags.macroName, color: '#88c0d0' },
  { tag: tags.variableName, color: '#8fbcbb' },
  { tag: tags.labelName, color: '#81a1c1' },
  { tag: tags.color, color: '#5e81ac' },
  { tag: tags.separator, color: '#a3be8c' },
  { tag: tags.brace, color: '#8fbcbb' },
  { tag: tags.annotation, color: '#d30102' },
  { tag: tags.number, color: '#b48ead' },
  { tag: tags.changed, color: '#b48ead' },
  { tag: tags.modifier, color: '#b48ead' },
  { tag: tags.self, color: '#b48ead' },
  { tag: tags.namespace, color: '#b48ead' },
  { tag: tags.typeName, color: '#ebcb8b' },
  { tag: tags.className, color: '#ebcb8b' },
  { tag: tags.operator, color: '#a3be8c' },
  { tag: tags.operatorKeyword, color: '#a3be8c' },
  { tag: tags.tagName, color: '#b48ead' },
  { tag: tags.squareBracket, color: '#bf616a' },
  { tag: tags.angleBracket, color: '#d08770' },
  { tag: tags.attributeName, color: '#ebcb8b' },
  { tag: tags.regexp, color: '#5e81ac' },
  { tag: tags.quote, color: '#b48ead' },
  { tag: tags.string, color: '#a3be8c' },
  { tag: tags.url, color: '#8fbcbb' },
  { tag: tags.escape, color: '#8fbcbb' },
  { tag: tags.meta, color: '#88c0d0' },
  { tag: tags.monospace, color: '#d8dee9', fontStyle: 'italic' },
  { tag: tags.comment, color: '#4c566a', fontStyle: 'italic' },
  { tag: tags.strong, color: '#5e81ac', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#5e81ac', fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.heading, color: '#5e81ac', fontWeight: 'bold' },
  { tag: tags.heading1, color: '#5e81ac', fontWeight: 'bold' },
  { tag: tags.heading2, color: '#5e81ac', fontWeight: 'bold' },
  { tag: tags.heading3, color: '#5e81ac', fontWeight: 'bold' },
  { tag: tags.heading4, color: '#5e81ac', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#5e81ac' },
  { tag: tags.heading6, color: '#5e81ac' },
  { tag: tags.atom, color: '#d08770' },
  { tag: tags.bool, color: '#d08770' },
  { tag: tags.processingInstruction, color: '#8fbcbb' },
  { tag: tags.inserted, color: '#8fbcbb' },
  { tag: tags.contentSeparator, color: '#ebcb8b' },
  { tag: tags.invalid, color: '#434c5e', borderBottom: '1px dotted #d30102' },
])

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#3F7F5F' },
  { tag: tags.keyword, color: '#7F0055', fontWeight: 'bold' },
  { tag: tags.atom, color: '#0000ff' },
  { tag: tags.number, color: '#016401' },
  { tag: tags.propertyName, color: '#016401' },
  { tag: tags.variableName, color: '#0000C0' },
  { tag: tags.string, color: '#2A00FF' },
  { tag: tags.operator, color: '#000000' },
  { tag: tags.tagName, color: '#016401' },
  { tag: tags.attributeName, color: '#0000cc' },
  { tag: tags.link, color: '#02199' },
])

export function createThemeExtension(theme: ThemeType): Extension[] {
  const baseTheme = theme === 'dark' ? darkBaseTheme : lightBaseTheme
  const highlightStyle = theme === 'dark' ? darkHighlightStyle : lightHighlightStyle
  
  return [
    baseTheme,
    syntaxHighlighting(highlightStyle, { fallback: true }),
  ]
}

export function updateEditorTheme(view: EditorView, theme: ThemeType): void {
  const dom = view.dom
  dom.classList.remove('cm-theme-dark', 'cm-theme-light')
  dom.classList.add(`cm-theme-${theme}`)
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
      ...createThemeExtension(theme),
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
