import type { IEditorLifecycle } from './editors/IEditorLifecycle'
import type { IEditorTabManager } from './editors/IEditorTabManager'
import type { IEditorContent } from './editors/IEditorContent'
import type { IEditorEventSource } from './editors/IEditorEventSource'
import type { IEditorView } from './editors/IEditorView'
import type { IEditorTheme } from './editors/IEditorTheme'
import type { IEditorCommandSource } from './editors/IEditorCommandSource'

export type { IEditorLifecycle } from './editors/IEditorLifecycle'
export type { IEditorTabManager } from './editors/IEditorTabManager'
export type { IEditorContent } from './editors/IEditorContent'
export type { IEditorEventSource } from './editors/IEditorEventSource'
export type { IEditorView, EditorSelection, EditorHeading } from './editors/IEditorView'
export type { IEditorTheme } from './editors/IEditorTheme'
export type { IEditorCommandSource } from './editors/IEditorCommandSource'

export type IEditorProvider =
  IEditorLifecycle &
  IEditorTabManager &
  IEditorContent &
  IEditorEventSource &
  IEditorView &
  IEditorTheme &
  IEditorCommandSource

// Re-export value objects for backward compatibility
export type { EditorSelection as Selection, EditorHeading as Heading } from './editors/IEditorView'
