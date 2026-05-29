<template>
  <div
    v-if="visible"
    class="command-palette"
    @keydown.escape="close"
  >
    <div
      class="command-palette-overlay"
      @click="close"
    />
    <div class="command-palette-container">
      <div class="command-palette-header">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="输入命令名称或快捷键搜索..."
          class="command-palette-input"
          @keydown.enter="executeSelected"
          @keydown.down.prevent="selectNext"
          @keydown.up.prevent="selectPrevious"
          @keydown.escape="close"
        >
      </div>
      <div
        ref="resultsContainer"
        class="command-palette-results"
      >
        <div
          v-for="(group, category) in filteredGroups"
          :key="category"
          class="command-group"
        >
          <div class="command-group-header">
            {{ getCategoryLabel(category) }}
          </div>
          <div
            v-for="command in group"
            :key="command.id"
            class="command-item"
            :class="{ selected: isSelected(command.id) }"
            @click="executeCommandHandler(command.id)"
            @mouseenter="selectedId = command.id"
          >
            <span class="command-label">{{ command.label }}</span>
            <span
              v-if="getShortcut(command.id)"
              class="command-shortcut"
            >
              {{ getShortcut(command.id) }}
            </span>
          </div>
        </div>
        <div
          v-if="filteredCommands.length === 0"
          class="no-results"
        >
          <p>没有找到匹配的命令</p>
        </div>
      </div>
      <div class="command-palette-footer">
        <span class="hint">↑↓ 导航</span>
        <span class="hint">Enter 执行</span>
        <span class="hint">Esc 关闭</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { executeCommand, getCommand } from '@/commands'
import { COMMANDS, CATEGORY_LABELS } from '@/commands/registry'
import { formatKeybinding } from '@/commands/types'
import type { CommandCategory } from '@/commands/types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const searchInput = ref<HTMLInputElement>()
const searchQuery = ref('')
const selectedId = ref<string>('')
const resultsContainer = ref<HTMLElement>()

// 获取平台
function getPlatform(): 'macOS' | 'windows' | 'linux' {
  if (navigator.platform.toLowerCase().includes('mac')) return 'macOS'
  if (navigator.platform.toLowerCase().includes('win')) return 'windows'
  return 'linux'
}

// 过滤命令
const filteredCommands = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) {
    return COMMANDS.filter(cmd => !cmd.hidden)
  }

  return COMMANDS.filter(cmd => {
    if (cmd.hidden) return false
    
    const labelMatch = cmd.label.toLowerCase().includes(query)
    const idMatch = cmd.id.toLowerCase().includes(query)
    const descMatch = cmd.description?.toLowerCase().includes(query)
    const shortcutMatch = getShortcut(cmd.id)?.toLowerCase().includes(query)
    
    return labelMatch || idMatch || descMatch || shortcutMatch
  })
})

// 按类别分组
const filteredGroups = computed(() => {
  const groups = new Map<CommandCategory, typeof COMMANDS>()
  
  for (const cmd of filteredCommands.value) {
    if (!groups.has(cmd.category)) {
      groups.set(cmd.category, [])
    }
    groups.get(cmd.category)!.push(cmd)
  }
  
  return groups
})

// 获取类别标签
function getCategoryLabel(category: CommandCategory): string {
  return CATEGORY_LABELS[category] || category
}

// 获取快捷键
function getShortcut(commandId: string): string | undefined {
  const command = getCommand(commandId)
  if (!command?.keybinding) return undefined
  return formatKeybinding(command.keybinding, getPlatform())
}

// 检查是否选中
function isSelected(commandId: string): boolean {
  return selectedId.value === commandId
}

// 选中下一个
function selectNext() {
  const commands = filteredCommands.value
  if (commands.length === 0) return

  const currentIndex = commands.findIndex(c => c.id === selectedId.value)
  const nextIndex = currentIndex < commands.length - 1 ? currentIndex + 1 : 0
  selectedId.value = commands[nextIndex].id
  scrollToSelected()
}

// 选中上一个
function selectPrevious() {
  const commands = filteredCommands.value
  if (commands.length === 0) return

  const currentIndex = commands.findIndex(c => c.id === selectedId.value)
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : commands.length - 1
  selectedId.value = commands[prevIndex].id
  scrollToSelected()
}

// 滚动到选中项
function scrollToSelected() {
  nextTick(() => {
    const container = resultsContainer.value
    const selected = container?.querySelector('.command-item.selected')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
}

// 执行选中的命令
function executeSelected() {
  if (selectedId.value) {
    executeCommandHandler(selectedId.value)
    close()
  }
}

// 执行命令
async function executeCommandHandler(commandId: string) {
  const result = await executeCommand(commandId)
  if (result.success) {
    close()
  }
}

// 关闭
function close() {
  searchQuery.value = ''
  selectedId.value = ''
  emit('close')
}

// 监听显示状态
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      searchInput.value?.focus()
      if (filteredCommands.value.length > 0) {
        selectedId.value = filteredCommands.value[0].id
      }
    })
  }
})

// 键盘事件
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      emit('close')
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.command-palette {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
}

.command-palette-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.command-palette-container {
  position: relative;
  width: 90%;
  max-width: 600px;
  background: var(--bg-primary, #1e1e1e);
  border-radius: 8px;
  box-shadow: 0 16px 70px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.command-palette-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #3a3a3a);
}

.command-palette-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: none;
  background: var(--bg-secondary, #252526);
  color: var(--text-primary, #cccccc);
  border-radius: 4px;
  outline: none;
}

.command-palette-input:focus {
  box-shadow: 0 0 0 2px var(--accent-color, #007acc);
}

.command-palette-input::placeholder {
  color: var(--text-secondary, #808080);
}

.command-palette-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.command-group {
  margin-bottom: 16px;
}

.command-group:last-child {
  margin-bottom: 0;
}

.command-group-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #808080);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.command-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.command-item:hover,
.command-item.selected {
  background: var(--bg-hover, #2a2d2e);
}

.command-item.selected {
  background: var(--accent-color, #007acc);
  color: white;
}

.command-label {
  font-size: 14px;
}

.command-shortcut {
  font-size: 12px;
  color: var(--text-secondary, #808080);
  font-family: monospace;
  padding: 2px 6px;
  background: var(--bg-tertiary, #333333);
  border-radius: 3px;
}

.command-item.selected .command-shortcut {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.no-results {
  text-align: center;
  padding: 32px;
  color: var(--text-secondary, #808080);
}

.command-palette-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color, #3a3a3a);
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hint {
  font-size: 12px;
  color: var(--text-secondary, #808080);
  font-family: monospace;
}
</style>
