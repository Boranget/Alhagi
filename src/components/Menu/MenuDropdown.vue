<template>
  <div
    class="menu-dropdown"
    @click.stop
  >
    <div class="menu-dropdown-content">
      <template
        v-for="(command, index) in commands"
        :key="command.id"
      >
        <div
          v-if="shouldShowSeparator(command, index)"
          class="menu-separator"
        />
        <MenuItem
          :command="command"
          @execute="handleExecute"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { executeCommand } from '@/commands'
import MenuItem from './MenuItem.vue'
import type { CommandEntry } from '@/commands/types'

const props = defineProps<{
  category: string
  commands: CommandEntry[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function shouldShowSeparator(command: CommandEntry, index: number): boolean {
  if (index === 0) return false
  
  const prevCommand = props.commands[index - 1]
  const groupDiff = (command.menuGroup ?? 0) - (prevCommand.menuGroup ?? 0)
  
  return groupDiff > 0
}

async function handleExecute(commandId: string) {
  const canExec = await executeCommand(commandId)
  if (!canExec.success) return

  emit('close')
}
</script>

<style scoped>
.menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  min-width: 220px;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.menu-dropdown-content {
  display: flex;
  flex-direction: column;
}

.menu-separator {
  height: 1px;
  background: var(--border-color, #3a3a3a);
  margin: 4px 8px;
}
</style>
