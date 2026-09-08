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
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          class="dialog-input"
          :placeholder="placeholder"
          @keydown.enter="confirm"
          @keydown.escape="cancel"
        >
      </div>
      <div class="dialog-footer">
        <button
          class="btn btn-secondary"
          @click="cancel"
        >
          {{ cancelText }}
        </button>
        <button
          class="btn btn-primary"
          @click="confirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  defaultValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
}>(), {
  defaultValue: '',
  placeholder: '',
  confirmText: '确定',
  cancelText: '取消',
})

const emit = defineEmits<{
  'confirm': [value: string]
  'cancel': []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const inputValue = ref(props.defaultValue)

watch(() => props.visible, async (val) => {
  if (val) {
    inputValue.value = props.defaultValue
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})

function confirm() {
  emit('confirm', inputValue.value)
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

.dialog-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--primary-color);
  }
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
</style>
