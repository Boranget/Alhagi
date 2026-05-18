<template>
  <svg 
    class="icon" 
    :class="[`icon-${name}`, { 'icon-sm': size === 'sm', 'icon-md': size === 'md', 'icon-lg': size === 'lg' }]"
    :width="iconSize"
    :height="iconSize"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <!-- 文件图标 - 简洁扁平风格 -->
    <template v-if="name === 'file'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="1"></polyline>
    </template>
    
    <!-- 文件夹图标 - 扁平风格 -->
    <template v-else-if="name === 'folder'">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </template>
    
    <!-- 文件夹打开图标 -->
    <template v-else-if="name === 'folder-open'">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1"></path>
      <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" stroke-width="1.5"></line>
    </template>
    
    <!-- 搜索图标 - 简洁扁平 -->
    <template v-else-if="name === 'search'">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"></circle>
      <line x1="15" y1="15" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
    </template>
    
    <!-- 保存图标 - 扁平风格 -->
    <template v-else-if="name === 'save'">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21" fill="none" stroke="currentColor" stroke-width="1.5"></polyline>
      <polyline points="7 3 7 8 15 8" fill="none" stroke="currentColor" stroke-width="1.5"></polyline>
    </template>
    
    <!-- 关闭图标 - 简洁X -->
    <template v-else-if="name === 'close'">
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
    </template>
    
    <!-- 垃圾桶图标 - 扁平简洁 -->
    <template v-else-if="name === 'trash'">
      <polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" stroke-width="1.5"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </template>
    
    <!-- 编辑/铅笔图标 - 扁平 -->
    <template v-else-if="name === 'edit'">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </template>
    
    <!-- 打字机图标 - 扁平简洁 -->
    <template v-else-if="name === 'typewriter'">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
      <line x1="6" y1="8" x2="6.01" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="10" y1="8" x2="10.01" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="14" y1="8" x2="14.01" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="18" y1="8" x2="18.01" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="8" y1="12" x2="8.01" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="12" y1="12" x2="12.01" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="16" y1="12" x2="16.01" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="7" y1="16" x2="17" y2="16" stroke="currentColor" stroke-width="1.5"></line>
    </template>
    
    <!-- 靶心/焦点图标 - 扁平简洁 -->
    <template v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
      <circle cx="12" cy="12" r="2"></circle>
    </template>
    
    <!-- 图片图标 - 扁平 -->
    <template v-else-if="name === 'image'">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" stroke-width="1.5"></polyline>
    </template>
    
    <!-- 语言/地球图标 - 扁平 -->
    <template v-else-if="name === 'globe'">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.5"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="1.5"></path>
    </template>
    
    <!-- 画笔/调色板图标 - 扁平 -->
    <template v-else-if="name === 'palette'">
      <circle cx="13.5" cy="6.5" r="1"></circle>
      <circle cx="17.5" cy="10.5" r="1"></circle>
      <circle cx="8.5" cy="7.5" r="1"></circle>
      <circle cx="6.5" cy="12.5" r="1"></circle>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" fill="none" stroke="currentColor" stroke-width="1.5"></path>
    </template>
    
    <!-- 工具图标 - 扁平 -->
    <template v-else-if="name === 'tool'">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="none" stroke="currentColor" stroke-width="1.5"></path>
    </template>
    
    <!-- 列表/大纲图标 - 扁平简洁 -->
    <template v-else-if="name === 'list'">
      <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <circle cx="4" cy="6" r="1"></circle>
      <circle cx="4" cy="12" r="1"></circle>
      <circle cx="4" cy="18" r="1"></circle>
    </template>
    
    <!-- 复制图标 - 扁平 -->
    <template v-else-if="name === 'copy'">
      <rect x="9" y="9" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="1.5"></path>
    </template>
    
    <!-- 菜单图标 - 扁平简洁 -->
    <template v-else-if="name === 'menu'">
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
    </template>
    
    <!-- 加号图标 - 扁平简洁 -->
    <template v-else-if="name === 'plus'">
      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
    </template>
    
    <!-- 减号图标 - 扁平简洁 -->
    <template v-else-if="name === 'minus'">
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
    </template>
    
    <!-- 右箭头图标 -->
    <template v-else-if="name === 'chevron-right'">
      <polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </template>
    
    <!-- 下箭头图标 -->
    <template v-else-if="name === 'chevron-down'">
      <polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </template>
    
    <!-- 设置图标 - 扁平简洁 -->
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.5"></path>
    </template>
    
    <!-- WYSIWYG模式图标 - 扁平圆点 -->
    <template v-else-if="name === 'wysiwyg'">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
      <circle cx="12" cy="12" r="4"></circle>
    </template>
    
    <!-- 代码模式图标 - 扁平简洁 -->
    <template v-else-if="name === 'code'">
      <polyline points="16 18 22 12 16 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <polyline points="8 6 2 12 8 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </template>
    
    <!-- 分屏模式图标 - 扁平 -->
    <template v-else-if="name === 'split'">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect>
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.5"></line>
    </template>
    
    <!-- 全屏图标 -->
    <template v-else-if="name === 'maximize'">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
    </template>
    
    <!-- 退出全屏图标 -->
    <template v-else-if="name === 'minimize'">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
    </template>
    
    <!-- 刷新图标 -->
    <template v-else-if="name === 'refresh'">
      <polyline points="23 4 23 10 17 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <polyline points="1 20 1 14 7 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </template>
    
    <!-- 折叠图标 -->
    <template v-else-if="name === 'collapse-left'">
      <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </template>
    
    <!-- 展开图标 -->
    <template v-else-if="name === 'expand-right'">
      <polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </template>
    
    <!-- 固定图标 -->
    <template v-else-if="name === 'pin'">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="1.5"></path>
      <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
    </template>
    
    <!-- 月亮图标 -->
    <template v-else-if="name === 'moon'">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </template>
    
    <!-- 太阳图标 -->
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></line>
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 14
    case 'lg':
      return 24
    default:
      return 16
  }
})
</script>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-md {
  width: 16px;
  height: 16px;
}

.icon-lg {
  width: 24px;
  height: 24px;
}
</style>
