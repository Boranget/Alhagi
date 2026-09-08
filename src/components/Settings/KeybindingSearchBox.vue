<template>
  <div class="search-box">
    <input
      :value="modelValue"
      type="text"
      placeholder="搜索快捷键..."
      class="search-input"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped lang="scss">
.search-box {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--primary-color);
  }

  &::placeholder {
    color: var(--text-secondary);
    opacity: 0.6;
  }
}
</style>
