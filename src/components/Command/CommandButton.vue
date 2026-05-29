<template>
  <button
    class="command-button"
    :class="{
      active: isActive,
      disabled: !canExecute
    }"
    :title="tooltip"
    :disabled="!canExecute"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { executeCommand, canExecuteCommand, getCommand } from '@/commands'
import { formatKeybinding } from '@/commands/types'

const props = defineProps<{
  commandId: string
  active?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

// 获取命令信息
const command = computed(() => getCommand(props.commandId))

// 检查是否可以执行
const canExecute = computed(() => canExecuteCommand(props.commandId))

// 是否激活
const isActive = computed(() => props.active ?? false)

// 工具提示
const tooltip = computed(() => {
  if (!command.value) return ''

  const parts: string[] = []

  // 标签
  if (command.value.label) {
    parts.push(command.value.label)
  }

  // 描述
  if (command.value.description) {
    parts.push(command.value.description)
  }

  // 快捷键
  if (command.value.keybinding) {
    const platform = navigator.platform.toLowerCase().includes('mac') ? 'macOS' : 'windows'
    const shortcut = formatKeybinding(command.value.keybinding, platform)
    parts.push(`(${shortcut})`)
  }

  // 禁用原因
  if (!canExecute.value) {
    parts.push('[不可用]')
  }

  return parts.join(' - ')
})

// 点击处理
async function handleClick(event: MouseEvent) {
  if (!canExecute.value) return

  emit('click', event)

  const result = await executeCommand(props.commandId)
  if (!result.success) {
    console.error(`[CommandButton] Command "${props.commandId}" failed:`, result.error)
  }
}
</script>

<style scoped>
.command-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #cccccc);
  background: var(--bg-secondary, #252526);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.command-button:hover:not(.disabled) {
  background: var(--bg-hover, #2a2d2e);
  border-color: var(--accent-color, #007acc);
}

.command-button:active:not(.disabled) {
  transform: scale(0.98);
}

.command-button.active {
  background: var(--accent-color, #007acc);
  color: white;
  border-color: var(--accent-color, #007acc);
}

.command-button.active:hover {
  background: var(--accent-color-dark, #005a9e);
}

.command-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 图标按钮样式 */
.command-button.icon-only {
  padding: 6px;
  min-width: 32px;
}

.command-button.icon-only :deep(svg) {
  width: 16px;
  height: 16px;
}
</style>
