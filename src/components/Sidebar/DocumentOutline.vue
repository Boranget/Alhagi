<template>
  <div class="document-outline">
    <div class="outline-header">
      <span>{{ t('documentOutline') }}</span>
    </div>
    <div
      v-if="headings.length > 0"
      class="outline-tree"
    >
      <OutlineTreeItem
        v-for="(node, index) in headings"
        :key="node.slug + '-' + index"
        :node="node"
        :active-pos="activePos"
        :depth="0"
        @select="handleHeadingClick"
      />
    </div>
    <div
      v-else
      class="empty-state"
    >
      <p>{{ t('noHeadings') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOutline } from '@/composables/useOutline'
import { t } from '@/services/i18n'
import OutlineTreeItem from './OutlineTreeItem.vue'

const { headings, activePos, handleHeadingClick } = useOutline()
</script>

<style scoped lang="scss">
.document-outline {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.outline-header {
  padding: 12px 16px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.outline-tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;

    &:hover {
      background: var(--scrollbar-thumb-hover);
    }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  padding: 20px;

  p {
    margin: 0;
    opacity: 0.6;
  }
}
</style>
