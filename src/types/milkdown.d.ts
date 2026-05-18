import type { Editor } from '@milkdown/core'
import type { EditorState, Transaction } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import type { Node, Schema } from '@milkdown/prose/model'
import type { Ctx } from '@milkdown/ctx'
import type { listenerCtx } from '@milkdown/plugin-listener'

export type MilkdownCtx = Ctx

export interface MilkdownEditorContext {
  get: <T>(key: unknown) => T
  set: <T>(key: unknown, value: T) => void
}

export interface ListenerPluginContext {
  markdownUpdated: (cb: (ctx: MilkdownCtx, markdown: string, prevMarkdown: string) => void) => void
}

export interface EditorActionContext {
  get: <T>(key: unknown) => T
}

export type EditorTransaction = Transaction
export type EditorDispatch = (tr: EditorTransaction) => void

export { Editor, EditorState, EditorView, Node, Schema }
