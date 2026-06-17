// text —— 纯文本可编辑（PlainTextEditor / CodeMirror）。
import { defineAsyncComponent } from 'vue'
import type { FileTypeDescriptor } from '../registry'

export const textDescriptor: FileTypeDescriptor = {
  id: 'text',
  displayName: 'Plain Text',
  extensions: [
    '.txt', '.log',
    '.json', '.jsonc', '.json5',
    '.yaml', '.yml',
    '.toml', '.ini', '.conf', '.config', '.env',
    '.xml', '.csv', '.tsv',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue',
    '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
    '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
    '.sql', '.gitignore', '.editorconfig', '.dockerignore',
  ],
  loadStrategy: 'utf8',
  canSave: true,
  defaultExtension: '',  // 不强加后缀；用户在另存为对话框里自己写
  viewer: defineAsyncComponent(() => import('@/components/Editor/PlainTextEditor.vue')),
}
