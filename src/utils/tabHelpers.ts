import type { TabState, ViewMode, FileType, EditorSpecificState } from '@/types'
import { TABS, EDITOR, FILE } from '@/constants'

export function createDefaultEditorState(): EditorSpecificState {
  return {
    cursor: { from: 0, to: 0 },
    scrollTop: 0,
    undoStack: [],
    redoStack: []
  }
}

export function validateTabState(tabState: unknown): tabState is TabState {
  if (!tabState || typeof tabState !== 'object') {
    return false
  }
  
  const obj = tabState as Record<string, unknown>
  const requiredFields = [
    'id', 'filePath', 'content', 'isDirty', 'title',
    'viewMode', 'fileType', 'createdAt', 'lastModified', 'lastSaved',
    'crepe', 'codeMirror'
  ]

  for (const field of requiredFields) {
    if (!(field in obj)) {
      return false
    }
  }

  if (typeof obj.id !== 'string' || !obj.id) {
    return false
  }

  if (typeof obj.content !== 'string') {
    return false
  }

  if (![EDITOR.VIEW_MODES.WYSIWYG, EDITOR.VIEW_MODES.SOURCE, EDITOR.VIEW_MODES.SPLIT].includes(obj.viewMode as ViewMode)) {
    return false
  }

  if (!['editor', 'image', 'unsupported'].includes(obj.fileType as string)) {
    return false
  }

  // 验证 crepe 和 codeMirror 编辑器状态
  const crepe = obj.crepe as Record<string, unknown>
  const codeMirror = obj.codeMirror as Record<string, unknown>
  
  if (!crepe || !codeMirror) {
    return false
  }

  if (typeof crepe.cursor !== 'object' || typeof codeMirror.cursor !== 'object') {
    return false
  }

  if (!Array.isArray(crepe.undoStack) || !Array.isArray(crepe.redoStack)) {
    return false
  }
  
  if (!Array.isArray(codeMirror.undoStack) || !Array.isArray(codeMirror.redoStack)) {
    return false
  }

  return true
}

export function detectFileType(filePath: string | null): FileType {
  if (!filePath) {
    return 'editor'
  }
  
  const ext = filePath.split('.').pop()?.toLowerCase()
  
  if (!ext) {
    return 'unsupported'
  }
  
  if (FILE.MARKDOWN_EXTENSIONS.some(mdExt => mdExt === `.${ext}`)) {
    return 'editor'
  }
  
  if (FILE.IMAGE_EXTENSIONS.some(imgExt => imgExt === `.${ext}`)) {
    return 'image'
  }
  
  return 'unsupported'
}

export function createDefaultTabState(id: string): TabState {
  return {
    id,
    filePath: null,
    content: '',
    isDirty: false,
    title: TABS.NEW_TAB_TITLE,
    viewMode: EDITOR.VIEW_MODES.WYSIWYG,
    fileType: 'editor',
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null,
    crepe: createDefaultEditorState(),
    codeMirror: createDefaultEditorState()
  }
}

export const MAX_UNDO_STACK_SIZE = EDITOR.MAX_UNDO_STACK_SIZE
export const MAX_REDO_STACK_SIZE = EDITOR.MAX_REDO_STACK_SIZE

export function trimHistoryStacks(editorState: EditorSpecificState): void {
  if (editorState.undoStack.length > MAX_UNDO_STACK_SIZE) {
    editorState.undoStack = editorState.undoStack.slice(-MAX_UNDO_STACK_SIZE)
  }
  if (editorState.redoStack.length > MAX_REDO_STACK_SIZE) {
    editorState.redoStack = editorState.redoStack.slice(-MAX_REDO_STACK_SIZE)
  }
}