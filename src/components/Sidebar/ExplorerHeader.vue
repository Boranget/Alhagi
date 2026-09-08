<template>
  <div class="explorer-header">
    <span>{{ t('sidebar.fileExplorer') }}</span>
    <div class="header-actions">
      <button
        class="action-btn"
        :title="t('common.newFile')"
        @click="$emit('new-file')"
      >
        <Icon
          name="file"
          size="sm"
        />
      </button>
      <button
        class="action-btn"
        :title="t('common.newFolder')"
        @click="$emit('new-folder')"
      >
        <Icon
          name="folder"
          size="sm"
        />
      </button>
      <button
        class="action-btn"
        :title="t('common.refresh')"
        @click="$emit('refresh')"
      >
        <Icon
          name="refresh"
          size="sm"
        />
      </button>
    </div>
  </div>
  <div class="explorer-toolbar">
    <button
      class="toolbar-btn"
      @click="$emit('open-folder')"
    >
      {{ t('common.openFolder') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

defineEmits<{
  'new-file': []
  'new-folder': []
  'refresh': []
  'open-folder': []
}>()
</script>

<style scoped lang="scss">
.explorer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;

    &:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }
  }
}

.explorer-toolbar {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;

  .toolbar-btn {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    background: var(--input-bg);
    color: var(--text-primary);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s;

    &:hover {
      border-color: var(--primary-color);
      background: var(--hover-bg);
    }
  }
}
</style>
