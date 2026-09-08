<template>
  <div
    v-if="visible"
    class="dialog-overlay"
    @click.self="cancel"
  >
    <div class="dialog">
      <div class="dialog-header">
        {{ title }}
      </div>
      <div class="dialog-body">
        <div
          v-for="(option, index) in options"
          :key="option.value"
          class="option-item"
          @click="select(option.value)"
        >
          <span class="option-index">{{ index + 1 }}</span>
          <span class="option-label">{{ option.label }}</span>
        </div>
      </div>
      <div class="dialog-footer">
        <button
          class="btn btn-secondary"
          @click="cancel"
        >
          {{ cancelText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface SelectOption {
  label: string
  value: string
}

defineProps<{
  visible: boolean
  title: string
  options: SelectOption[]
  cancelText?: string
}>()

const emit = defineEmits<{
  'select': [value: string]
  'cancel': []
}>()

function select(value: string) {
  emit('select', value)
}

function cancel() {
  emit('cancel')
}
</script>

<style scoped lang="scss">
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--panel-bg);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  min-width: 360px;
  max-width: 90vw;
  overflow: hidden;
}

.dialog-header {
  padding: 20px 24px 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.dialog-body {
  padding: 0 24px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--hover-bg);
  }
}

.option-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--primary-color);
  color: white;
  font-size: 12px;
  font-weight: 600;
}

.option-label {
  font-size: 14px;
  color: var(--text-primary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px 20px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &.secondary {
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-color);

    &:hover {
      background: var(--hover-bg);
    }
  }
}
</style>
