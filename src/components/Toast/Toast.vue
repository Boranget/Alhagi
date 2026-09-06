<template>
  <Transition name="toast-slide">
    <div
      v-if="visible"
      class="toast-container"
    >
      <div
        class="toast-item"
        :class="[`toast-${type}`]"
      >
        <span class="toast-message">{{ message }}</span>
        <button
          class="toast-close"
          @click="hide"
        >
          ×
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const visible = ref(false)
const message = ref('')
const type = ref<'info' | 'success' | 'warning' | 'error'>('info')

let hideTimer: ReturnType<typeof setTimeout> | null = null

function show(msg: string, options?: { type?: typeof type.value; duration?: number }) {
  if (hideTimer) clearTimeout(hideTimer)
  message.value = msg
  type.value = options?.type ?? 'info'
  visible.value = true

  const duration = options?.duration ?? 3000
  hideTimer = setTimeout(() => {
    visible.value = false
  }, duration)
}

function hide() {
  if (hideTimer) clearTimeout(hideTimer)
  visible.value = false
}

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer)
})

defineExpose({ show, hide })
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--panel-bg, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  color: var(--text-primary, #333);
  pointer-events: auto;
  max-width: 400px;
  word-break: break-word;
}

.toast-info {
  border-left: 3px solid #3b82f6;
}

.toast-success {
  border-left: 3px solid #22c55e;
}

.toast-warning {
  border-left: 3px solid #f59e0b;
}

.toast-error {
  border-left: 3px solid #ef4444;
}

.toast-close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--text-secondary, #999);
  padding: 0 2px;
  line-height: 1;
}

.toast-close:hover {
  color: var(--text-primary, #333);
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 250ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
