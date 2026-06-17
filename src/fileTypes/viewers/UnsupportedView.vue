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
/**
 * 不支持文件类型的提示视图。注册为 unsupported descriptor 的 viewer，
 * 由 EditorContainer 当作覆盖层挂载。
 */
import { t } from '@/services/i18n'
import { Icon } from '@/components/Icons'

defineProps<{
  filePath: string | null
}>()
</script>

<style scoped lang="scss">
.unsupported-file-message {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
  text-align: center;
  padding: 40px;
  background: var(--editor-bg);
  box-sizing: border-box;

  .message-icon {
    font-size: 64px;
    color: var(--text-secondary);
    opacity: 0.5;
  }

  h3 {
    margin: 0;
    color: var(--text-primary);
  }

  p {
    margin: 0;
    font-size: 14px;
    max-width: 500px;
    word-break: break-all;
  }

  .hint {
    font-size: 13px;
    opacity: 0.7;
    margin-top: 8px;
  }
}
</style>
