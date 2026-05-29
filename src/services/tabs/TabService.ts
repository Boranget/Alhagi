import type { TabState, ViewMode, FileType } from '@/types'
import { TABS, EDITOR, FILE } from '@/constants'

export function validateTabState(tabState: unknown): tabState is TabState {
  if (!tabState || typeof tabState !== 'object') {
    return false
  }
  
  const obj = tabState as Record<string, unknown>
  const requiredFields = [
    'id', 'filePath', 'content', 'isDirty', 'title', 'active',
    'cursor', 'scrollTop', 'viewMode', 'fileType', 'undoStack', 'redoStack',
    'createdAt', 'lastModified', 'lastSaved'
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

  if (typeof obj.cursor !== 'object' || 
      typeof (obj.cursor as Record<string, unknown>)?.from !== 'number' || 
      typeof (obj.cursor as Record<string, unknown>)?.to !== 'number') {
    return false
  }

  if (![EDITOR.VIEW_MODES.WYSIWYG, EDITOR.VIEW_MODES.SOURCE, EDITOR.VIEW_MODES.SPLIT].includes(obj.viewMode as ViewMode)) {
    return false
  }

  if (!['editor', 'image', 'unsupported'].includes(obj.fileType as string)) {
    return false
  }

  if (!Array.isArray(obj.undoStack) || !Array.isArray(obj.redoStack)) {
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
    active: false,
    cursor: { from: 0, to: 0 },
    scrollTop: 0,
    viewMode: EDITOR.VIEW_MODES.WYSIWYG,
    fileType: 'editor',
    undoStack: [],
    redoStack: [],
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null
  }
}

export const MAX_UNDO_STACK_SIZE = EDITOR.MAX_UNDO_STACK_SIZE
export const MAX_REDO_STACK_SIZE = EDITOR.MAX_REDO_STACK_SIZE

export function trimHistoryStacks(tab: TabState): void {
  if (tab.undoStack.length > MAX_UNDO_STACK_SIZE) {
    tab.undoStack = tab.undoStack.slice(-MAX_UNDO_STACK_SIZE)
  }
  if (tab.redoStack.length > MAX_REDO_STACK_SIZE) {
    tab.redoStack = tab.redoStack.slice(-MAX_REDO_STACK_SIZE)
  }
}
