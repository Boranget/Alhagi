import { markRule } from '@milkdown/prose'
import { toggleMark } from '@milkdown/prose/commands'
import {
  $command,
  $inputRule,
  $markSchema,
} from '@milkdown/utils'
import type { MarkType, Node as ProsemirrorNode } from '@milkdown/kit/prose/model'
import type { Mark } from '@milkdown/kit/prose'

export const highlightSchema = $markSchema('highlight', () => ({
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', { class: 'highlight' }] as const,
  parseMarkdown: {
    match: (node: Record<string, unknown>) => node.type === 'highlight',
    runner: (state: Mark, node: Record<string, unknown>, markType: MarkType) => {
      state.openMark(markType)
      state.next((node.children as ProsemirrorNode[]))
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'highlight',
    runner: (state, mark) => {
      state.withMark(mark, 'highlight')
    },
  },
}))

export const toggleHighlightCommand = $command(
  'ToggleHighlight',
  (ctx: Record<string, unknown>) => () => toggleMark(highlightSchema.type(ctx))
)

export const highlightInputRule = $inputRule((ctx: Record<string, unknown>) =>
  markRule(/==([^=\n]+)==$/, highlightSchema.type(ctx))
)

export const superscriptSchema = $markSchema('superscript', () => ({
  parseDOM: [{ tag: 'sup' }],
  toDOM: () => ['sup', {}] as const,
  parseMarkdown: {
    match: (node: Record<string, unknown>) => node.type === 'superscript',
    runner: (state: Mark, node: Record<string, unknown>, markType: MarkType) => {
      state.openMark(markType)
      state.next((node.children as ProsemirrorNode[]))
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'superscript',
    runner: (state: Mark, mark: Mark) => {
      state.withMark(mark, 'superscript')
    },
  },
}))

export const toggleSuperscriptCommand = $command(
  'ToggleSuperscript',
  (ctx: Record<string, unknown>) => () => toggleMark(superscriptSchema.type(ctx))
)

export const superscriptInputRule = $inputRule((ctx: Record<string, unknown>) =>
  // eslint-disable-next-line no-useless-escape
  markRule(/\^([^\^\n]+)\^$/, superscriptSchema.type(ctx))
)

export const subscriptSchema = $markSchema('subscript', () => ({
  parseDOM: [{ tag: 'sub' }],
  toDOM: () => ['sub', {}] as const,
  parseMarkdown: {
    match: (node: Record<string, unknown>) => node.type === 'subscript',
    runner: (state: Mark, node: Record<string, unknown>, markType: MarkType) => {
      state.openMark(markType)
      state.next((node.children as ProsemirrorNode[]))
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'subscript',
    runner: (state: Mark, mark: Mark) => {
      state.withMark(mark, 'subscript')
    },
  },
}))

export const toggleSubscriptCommand = $command(
  'ToggleSubscript',
  (ctx: Record<string, unknown>) => () => toggleMark(subscriptSchema.type(ctx))
)

export const inlineMarksPlugin = [
  highlightSchema,
  toggleHighlightCommand,
  highlightInputRule,
  superscriptSchema,
  toggleSuperscriptCommand,
  superscriptInputRule,
  subscriptSchema,
  toggleSubscriptCommand,
].flat()
