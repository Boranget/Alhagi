<template>
  <div class="settings-footer">
    <button
      class="btn secondary"
      @click="$emit('reset-all')"
    >
      重置全部
    </button>
    <div class="export-import">
      <button
        class="btn secondary"
        @click="$emit('export')"
      >
        导出
      </button>
      <button
        class="btn secondary"
        @click="$emit('import')"
      >
        导入
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept=".json"
        style="display: none"
        @change="$emit('import-file', $event)"
      >
    </div>
    <button
      class="btn primary"
      @click="$emit('save')"
    >
      保存
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const fileInputRef = ref<HTMLInputElement | null>(null)

defineEmits<{
  'reset-all': []
  'export': []
  'import': []
  'import-file': [event: Event]
  'save': []
}>()

defineExpose({
  triggerImport: () => fileInputRef.value?.click()
})
</script>

<style scoped lang="scss">
.settings-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  gap: 12px;

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;

    &.primary {
      background: var(--primary-color);
      color: white;
      border: none;

      &:hover {
        opacity: 0.9;
      }
    }

    &.secondary {
      background: transparent;
      color: var(--text-primary);
      border: 1px solid var(--border-color);

      &:hover {
        background: var(--hover-bg);
      }
    }
  }

  .export-import {
    display: flex;
    gap: 8px;
  }
}
</style>
