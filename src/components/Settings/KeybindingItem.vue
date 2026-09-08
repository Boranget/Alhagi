<template>
  <div class="keybinding-item">
    <div class="binding-info">
      <span class="binding-description">{{ description }}</span>
    </div>
    <div
      class="binding-key"
      @click="$emit('record')"
    >
      <span
        v-if="isRecording"
        class="recording"
      >
        按键中...
      </span>
      <span
        v-else
        class="key-display"
      >
        {{ displayKey || '无' }}
      </span>
      <button
        v-if="isModified"
        class="reset-btn"
        title="重置为默认"
        @click.stop="$emit('reset')"
      >
        ↩
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  description: string
  displayKey: string
  isRecording: boolean
  isModified: boolean
}>()

defineEmits<{
  record: []
  reset: []
}>()
</script>

<style scoped lang="scss">
.keybinding-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.15s;

  &:hover {
    background-color: var(--hover-bg);
  }
}

.binding-info {
  flex: 1;
  min-width: 0;
}

.binding-description {
  font-size: 14px;
  color: var(--text-primary);
}

.binding-key {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 6px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  cursor: pointer;
  min-width: 120px;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    border-color: var(--primary-color);
    background: var(--hover-bg);
  }
}

.key-display {
  font-size: 13px;
  font-family: monospace;
  color: var(--text-primary);
}

.recording {
  font-size: 13px;
  color: var(--primary-color);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.reset-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.15s;

  &:hover {
    color: var(--primary-color);
    background: var(--hover-bg);
  }
}
</style>
