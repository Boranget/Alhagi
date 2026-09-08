<template>
  <div class="outline-tree-node">
    <div
      class="outline-item"
      :class="{
        active: activePos === node.pos,
        [`depth-${depth}`]: true,
      }"
      :title="node.label"
      @click="$emit('select', node)"
    >
      <span
        class="heading-marker"
        :style="{ width: markerWidth + 'px' }"
      />
      <span class="heading-text">{{ node.label }}</span>
    </div>
    <div
      v-if="node.children.length > 0"
      class="outline-children"
    >
      <OutlineTreeItem
        v-for="(child, index) in node.children"
        :key="child.slug + '-' + index"
        :node="child"
        :active-pos="activePos"
        :depth="depth + 1"
        @select="(n: HeadingTreeNode) => $emit('select', n)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HeadingTreeNode } from '@/utils/headings'
import OutlineTreeItem from './OutlineTreeItem.vue'

interface Props {
  node: HeadingTreeNode
  activePos: number | null
  depth: number
}

defineProps<Props>()

defineEmits<{
  select: [node: HeadingTreeNode]
}>()

const markerWidth = computed(() => {
  // 根据深度计算左侧指示线的缩进
  return 4 + (12 * 0)
})
</script>

<style scoped lang="scss">
.outline-tree-node {
  user-select: none;
}

.outline-item {
  display: flex;
  align-items: center;
  padding: 3px 12px 3px 0;
  cursor: pointer;
  border-radius: 0;
  font-size: 12px;
  color: var(--text-primary);
  transition: all 0.1s ease;
  position: relative;
  margin: 0;

  &:hover {
    background: var(--sidebar-hover-bg);

    .heading-marker {
      background: var(--text-secondary);
    }
  }

  &.active {
    background: var(--sidebar-active-bg, rgba(var(--primary-rgb), 0.08));
    color: var(--primary-color);

    .heading-marker {
      background: var(--primary-color);
    }
  }

  &.depth-0 {
    padding-left: 16px;
    font-weight: 600;
    font-size: 13px;
  }

  &.depth-1 {
    padding-left: 28px;
  }

  &.depth-2 {
    padding-left: 40px;
  }

  &.depth-3 {
    padding-left: 52px;
  }

  &.depth-4 {
    padding-left: 64px;
  }

  &.depth-5 {
    padding-left: 76px;
  }

  &.depth-6 {
    padding-left: 88px;
  }
}

.heading-marker {
  flex-shrink: 0;
  height: 14px;
  width: 3px;
  border-radius: 1.5px;
  margin-right: 8px;
  background: transparent;
  transition: background 0.15s;
}

.heading-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.outline-children {
  .outline-item {
    font-weight: 400;
    font-size: 12px;
  }
}
</style>