<template>
  <div
    class="menu-item"
    :class="{ disabled: !isEnabled }"
    @click="handleClick"
  >
    <span class="menu-item-label">{{ command.label }}</span>
    <span
      v-if="shortcut"
      class="menu-item-shortcut"
    >{{ shortcut }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { canExecuteCommand } from '@/commands/dispatcher'
import { getPlatformKeybinding } from '@/commands/registry'
import { formatKeybinding } from '@/commands/types'
import type { CommandEntry } from '@/commands/types'

const props = defineProps<{
  command: CommandEntry
}>()

const emit = defineEmits<{
  (e: 'execute', commandId: string): void
}>()

const isEnabled = computed(() => canExecuteCommand(props.command.id))

const shortcut = computed(() => {
  const keybinding = getPlatformKeybinding(props.command)
  if (!keybinding) return null
  
  const platform = getPlatform()
  return formatKeybinding(keybinding, platform)
})

function getPlatform(): 'macOS' | 'windows' | 'linux' {
  if (navigator.platform.toLowerCase().includes('mac')) return 'macOS'
  if (navigator.platform.toLowerCase().includes('win')) return 'windows'
  return 'linux'
}

function handleClick() {
  if (!isEnabled.value) return
  emit('execute', props.command.id)
}
</script>

<style scoped>
.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.1s;
  min-height: 28px;
}

.menu-item:hover:not(.disabled) {
  background: var(--accent-color, #007acc);
  color: white;
}

.menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-item-label {
  flex: 1;
  font-size: 13px;
  color: inherit;
}

.menu-item-shortcut {
  margin-left: 20px;
  font-size: 12px;
  font-family: monospace;
  color: var(--text-secondary, #808080);
  white-space: nowrap;
}

.menu-item:hover:not(.disabled) .menu-item-shortcut {
  color: rgba(255, 255, 255, 0.7);
}
</style>
