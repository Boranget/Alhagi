// editor —— Markdown 主编辑器（Crepe + CodeMirror）。
// viewer 为 null：EditorContainer 里直接渲染主编辑器外壳，不走覆盖层。
import type { FileTypeDescriptor } from '../registry'

export const editorDescriptor: FileTypeDescriptor = {
  id: 'editor',
  displayName: 'Markdown',
  extensions: ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'],
  loadStrategy: 'utf8',
  canSave: true,
  defaultExtension: '.md',
  viewer: null,
}
