// ============================================================
// FileTypes 入口 —— 集中注册所有 descriptor
// ============================================================
//
// 加新文件类型：
//   1. 写 viewer：src/fileTypes/viewers/XxxView.vue
//   2. 写 descriptor：src/fileTypes/descriptors/xxx.ts
//   3. 在本文件 import + registerFileType
//
// 这一改动是闭环的：EditorContainer / FileExplorer / tabService /
// detectFileType / validateTabState 都通过 registry 查询，无需改动。

import { registerFileType } from './registry'
import { editorDescriptor } from './descriptors/editor'
import { textDescriptor } from './descriptors/text'
import { imageDescriptor } from './descriptors/image'
import { unsupportedDescriptor } from './descriptors/unsupported'

// editor 需要先注册：detectDescriptor 在 filePath==null（欢迎页）时会找它
registerFileType(editorDescriptor)
registerFileType(textDescriptor)
registerFileType(imageDescriptor)
registerFileType(unsupportedDescriptor, /* isFallback */ true)

export {
  registerFileType,
  detectDescriptor,
  getDescriptor,
  listDescriptors,
  getRegisteredIds,
  type FileTypeDescriptor,
  type LoadStrategy,
} from './registry'
