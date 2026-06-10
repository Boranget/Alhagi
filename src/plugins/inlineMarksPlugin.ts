import { markRule } from '@milkdown/prose'
import { toggleMark } from '@milkdown/prose/commands'
import {
  $command,
  $inputRule,
  $markSchema,
} from '@milkdown/utils'
import type { Ctx } from '@milkdown/ctx'
import type { Mark, MarkType } from '@milkdown/kit/prose/model'
import type { MarkdownNode, ParserState, SerializerState } from '@milkdown/transformer'

export const highlightSchema = $markSchema('highlight', () => ({
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', { class: 'highlight' }] as const,
  parseMarkdown: {
    match: (node: MarkdownNode) => node.type === 'highlight',
    runner: (state: ParserState, node: MarkdownNode, markType: MarkType) => {
      state.openMark(markType)
      state.next((node.children as MarkdownNode[]))
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'highlight',
    runner: (state: SerializerState, mark: Mark) => {
      state.withMark(mark, 'highlight')
    },
  },
}))

export const toggleHighlightCommand = $command(
  'ToggleHighlight',
  (ctx: Ctx) => () => toggleMark(highlightSchema.type(ctx))
)

export const highlightInputRule = $inputRule((ctx: Ctx) =>
  markRule(/==([^=\n]+)==$/, highlightSchema.type(ctx))
)

export const superscriptSchema = $markSchema('superscript', () => ({
  parseDOM: [{ tag: 'sup' }],
  toDOM: () => ['sup', {}] as const,
  parseMarkdown: {
    match: (node: MarkdownNode) => node.type === 'superscript',
    runner: (state: ParserState, node: MarkdownNode, markType: MarkType) => {
      state.openMark(markType)
      state.next((node.children as MarkdownNode[]))
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'superscript',
    runner: (state: SerializerState, mark: Mark) => {
      state.withMark(mark, 'superscript')
    },
  },
}))

export const toggleSuperscriptCommand = $command(
  'ToggleSuperscript',
  (ctx: Ctx) => () => toggleMark(superscriptSchema.type(ctx))
)

export const superscriptInputRule = $inputRule((ctx: Ctx) =>
  // eslint-disable-next-line no-useless-escape
  markRule(/\^([^\^\n]+)\^$/, superscriptSchema.type(ctx))
)

export const subscriptSchema = $markSchema('subscript', () => ({
  parseDOM: [{ tag: 'sub' }],
  toDOM: () => ['sub', {}] as const,
  parseMarkdown: {
    match: (node: MarkdownNode) => node.type === 'subscript',
    runner: (state: ParserState, node: MarkdownNode, markType: MarkType) => {
      state.openMark(markType)
      state.next((node.children as MarkdownNode[]))
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'subscript',
    runner: (state: SerializerState, mark: Mark) => {
      state.withMark(mark, 'subscript')
    },
  },
}))

export const toggleSubscriptCommand = $command(
  'ToggleSubscript',
  (ctx: Ctx) => () => toggleMark(subscriptSchema.type(ctx))
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
