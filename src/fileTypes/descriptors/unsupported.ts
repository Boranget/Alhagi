// unsupported —— 兜底类型。任何未匹配到的扩展名都落到这里。
import { defineAsyncComponent } from 'vue'
import type { FileTypeDescriptor } from '../registry'

export const unsupportedDescriptor: FileTypeDescriptor = {
  id: 'unsupported',
  displayName: 'Unsupported',
  extensions: [],
  loadStrategy: 'none',
  canSave: false,
  defaultExtension: '',
  viewer: defineAsyncComponent(() => import('../viewers/UnsupportedView.vue')),
}
