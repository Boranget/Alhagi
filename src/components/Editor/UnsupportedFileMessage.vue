<template>
  <div class="unsupported-file-message">
    <Icon
      name="file"
      size="lg"
      class="message-icon"
    />
    <h3>{{ t('editor.unsupportedFileType') }}</h3>
    <p>{{ filePath }}</p>
    <p class="hint">
      {{ t('editor.onlyMarkdownSupported') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

defineProps<{
  filePath: string
}>()
</script>

<style scoped lang="scss">
.unsupported-file-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  text-align: center;
  padding: 40px;

  .message-icon {
    margin-bottom: 16px;
    opacity: 0.5;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  p {
    margin: 0;
    font-size: 13px;
  }

  .hint {
    margin-top: 8px;
    opacity: 0.7;
  }
}
</style>
