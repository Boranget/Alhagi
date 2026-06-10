<template>
  <Transition name="dialog">
    <div
      v-if="visible"
      class="shortcuts-dialog-overlay"
      @click.self="close"
    >
      <div class="shortcuts-dialog">
        <div class="dialog-header">
          <h2>快捷键列表</h2>
          <button
            class="close-button"
            @click="close"
          >
            ✕
          </button>
        </div>
        <div class="dialog-content">
          <div class="shortcuts-grid">
            <div
              v-for="group in groupedShortcuts"
              :key="group.category"
              class="shortcut-category"
            >
              <h3 class="category-title">
                {{ getCategoryLabel(group.category) }}
              </h3>
              <div class="shortcut-list">
                <div
                  v-for="command in group.commands"
                  :key="command.id"
                  class="shortcut-item"
                >
                  <span class="shortcut-label">{{ t(command.label) }}</span>
                  <span
                    v-if="command.shortcut"
                    class="shortcut-keys"
                  >
                    <kbd
                      v-for="(key, i) in parseShortcut(command.shortcut)"
                      :key="i"
                    >
                      {{ key }}
                    </kbd>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <span class="version">按 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> 打开命令面板</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { COMMANDS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/commands/registry'
import { getPlatformKeybinding } from '@/commands/registry'
import { formatKeybinding } from '@/commands/types'
import { t } from '@/services/i18n'
import type { CommandCategory } from '@/commands/types'

const _props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// 获取平台
function getPlatform(): 'macOS' | 'windows' | 'linux' {
  if (navigator.platform.toLowerCase().includes('mac')) return 'macOS'
  if (navigator.platform.toLowerCase().includes('win')) return 'windows'
  return 'linux'
}

const platform = getPlatform()

// 获取类别标签
function getCategoryLabel(category: CommandCategory): string {
  return t(CATEGORY_LABELS[category] || category)
}

// 获取所有带快捷键的命令，按类别分组（返回数组以便模板稳定遍历）
const groupedShortcuts = computed(() => {
  const groups = new Map<CommandCategory, Array<{ id: string; label: string; shortcut?: string }>>()

  // 过滤有快捷键的命令
  const commandsWithShortcuts = COMMANDS.filter(cmd => {
    if (cmd.hidden) return false
    return !!getPlatformKeybinding(cmd)
  })

  // 按类别分组
  for (const cmd of commandsWithShortcuts) {
    if (!groups.has(cmd.category)) {
      groups.set(cmd.category, [])
    }

    const shortcut = getPlatformKeybinding(cmd)
    groups.get(cmd.category)!.push({
      id: cmd.id,
      label: cmd.label,
      shortcut: shortcut ? formatKeybinding(shortcut, platform) : undefined,
    })
  }

  // 类别按 CATEGORY_ORDER 排序，类内按 menuGroup/menuOrder 排序
  return Array.from(groups.entries())
    .sort(([a], [b]) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b])
    .map(([category, commands]) => {
      const sorted = commands.slice().sort((a, b) => {
        const cmdA = COMMANDS.find(c => c.id === a.id)
        const cmdB = COMMANDS.find(c => c.id === b.id)
        const groupDiff = (cmdA?.menuGroup ?? 0) - (cmdB?.menuGroup ?? 0)
        if (groupDiff !== 0) return groupDiff
        return (cmdA?.menuOrder ?? 0) - (cmdB?.menuOrder ?? 0)
      })
      return { category, commands: sorted }
    })
})

// 解析快捷键字符串
function parseShortcut(shortcut: string): string[] {
  // Windows/Linux: "Ctrl+B" -> ["Ctrl", "B"]
  // macOS: "⌘B" -> ["⌘", "B"]
  if (platform === 'macOS') {
    // macOS 格式已经合并，如 "⌘B"
    return shortcut.split('').filter(c => c.trim())
  }
  
  // Windows/Linux
  return shortcut.split('+')
}

// 关闭
function close() {
  emit('close')
}
</script>

<style scoped>
.shortcuts-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.shortcuts-dialog {
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  background: var(--bg-primary, #1e1e1e);
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color, #3a3a3a);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #cccccc);
}

.close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #808080);
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-button:hover {
  background: var(--bg-hover, #2a2d2e);
  color: var(--text-primary, #cccccc);
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.shortcut-category {
  background: var(--bg-secondary, #252526);
  border-radius: 6px;
  padding: 16px;
}

.category-title {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-color, #007acc);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color, #3a3a3a);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-primary, #1e1e1e);
  border-radius: 4px;
  transition: background-color 0.15s;
}

.shortcut-item:hover {
  background: var(--bg-hover, #2a2d2e);
}

.shortcut-label {
  font-size: 13px;
  color: var(--text-primary, #cccccc);
  flex: 1;
}

.shortcut-keys {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

kbd {
  display: inline-block;
  padding: 4px 8px;
  font-size: 12px;
  font-family: monospace;
  font-weight: 500;
  color: var(--text-primary, #cccccc);
  background: var(--bg-tertiary, #333333);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 4px;
  box-shadow: 0 2px 0 var(--border-color, #3a3a3a);
  min-width: 24px;
  text-align: center;
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color, #3a3a3a);
  text-align: center;
}

.version {
  font-size: 13px;
  color: var(--text-secondary, #808080);
}

.version kbd {
  font-size: 11px;
  padding: 2px 6px;
  margin: 0 2px;
}

/* 过渡动画 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-active .shortcuts-dialog,
.dialog-leave-active .shortcuts-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .shortcuts-dialog,
.dialog-leave-to .shortcuts-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
