<template>
  <div
    class="file-tree-node"
    :class="{ selected: isSelected, expanded: node.expanded }"
    :style="{ paddingLeft: `${depth * 16 + 8}px` }"
    @click="handleClick"
    @contextmenu="handleContextMenu"
  >
    <Icon
      v-if="node.type === 'directory'"
      :name="node.expanded ? 'chevron-down' : 'chevron-right'"
      size="sm"
      class="expand-marker"
    />
    <span
      v-else
      class="expand-spacer"
    />
    <Icon
      :name="nodeIcon"
      size="sm"
      class="node-icon"
    />
    <span class="node-name">{{ node.name }}</span>
    <span
      v-if="node.isDirty"
      class="dirty-indicator"
    >●</span>
  </div>
  <div
    v-if="node.expanded && node.children"
    class="node-children"
  >
    <FileTreeNode
      v-for="child in node.children"
      :key="child.path"
      :node="child"
      :depth="depth + 1"
      @select="$emit('select', $event)"
      @contextmenu="(event: MouseEvent) => $emit('contextmenu', event, child)"
      @toggle="$emit('toggle', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileTreeNodeType } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { Icon } from '@/components/Icons'

const props = defineProps<{
  node: FileTreeNodeType
  depth: number
}>()

const emit = defineEmits<{
  (e: 'select', node: FileTreeNodeType): void
  (e: 'contextmenu', event: MouseEvent, node: FileTreeNodeType): void
  (e: 'toggle', node: FileTreeNodeType): void
}>()

const tabsStore = useTabsStore()

const nodeIcon = computed(() => {
  if (props.node.type === 'directory') {
    return props.node.expanded ? 'folder-open' : 'folder'
  }
  
  const ext = props.node.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'file'
    case 'json':
      return 'file'
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return 'file'
    case 'html':
      return 'globe'
    case 'css':
    case 'scss':
    case 'sass':
      return 'palette'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return 'image'
    default:
      return 'file'
  }
})

const isSelected = computed(() => {
  return tabsStore.activeTab?.filePath === props.node.path
})

function handleClick() {
  if (props.node.type === 'directory') {
    emit('toggle', props.node)
  } else {
    emit('select', props.node)
  }
}

function handleContextMenu(event: MouseEvent) {
  emit('contextmenu', event, props.node)
}
</script>

<style scoped lang="scss">
.file-tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  transition: all 0.15s;
  user-select: none;

  &:hover {
    background: var(--sidebar-hover-bg);
  }

  &.selected {
    background: var(--primary-color);
    color: white;
  }
}

.expand-marker,
.expand-spacer {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.expand-marker {
  color: var(--text-secondary);
}

.file-tree-node:hover .expand-marker {
  color: var(--text-primary);
}

.file-tree-node.selected .expand-marker {
  color: white;
}

.node-icon {
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-indicator {
  color: var(--primary-color);
  font-size: 10px;
}

.node-children {
  animation: expand 0.2s ease-out;
}

@keyframes expand {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
