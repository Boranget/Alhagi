// image —— 图片预览（只读）。
import { defineAsyncComponent } from 'vue'
import type { FileTypeDescriptor } from '../registry'

export const imageDescriptor: FileTypeDescriptor = {
  id: 'image',
  displayName: 'Image',
  extensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
  loadStrategy: 'none', // ImagePreview 自己用 readBinaryFile 取数据
  canSave: false,
  defaultExtension: '',
  viewer: defineAsyncComponent(() => import('@/components/Editor/ImagePreview.vue')),
}
