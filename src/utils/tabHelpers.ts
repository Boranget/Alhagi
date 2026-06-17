import type { TabState, ViewMode, FileType, EditorSpecificState } from '@/types'
import { TABS, EDITOR } from '@/constants'
import { detectDescriptor, getRegisteredIds } from '@/fileTypes'

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

  if (!getRegisteredIds().includes(obj.fileType as string)) {
    return false
  }

  if ('splitRatio' in obj && (typeof obj.splitRatio !== 'number' || obj.splitRatio < 0 || obj.splitRatio > 100)) {
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

/**
 * 路径 → FileType id。委托给 fileTypes registry —— 不再在这里维护扩展名清单。
 * 兼容旧调用方（FileExplorer / tabService 等仍在用 detectFileType(path)）。
 */
export function detectFileType(filePath: string | null): FileType {
  return detectDescriptor(filePath).id as FileType
}

export function createDefaultTabState(id: string): TabState {
  return {
    id,
    filePath: null,
    content: '',
    isDirty: false,
    title: TABS.NEW_TAB_TITLE,
    viewMode: EDITOR.VIEW_MODES.WYSIWYG,
    splitRatio: 50,
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