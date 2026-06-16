<template>
  <div
    class="keyboard-settings-overlay"
    tabindex="-1"
    @click="close"
    @keyup.esc="close"
  >
    <div
      class="keyboard-settings-panel"
      @click.stop
    >
      <div class="settings-header">
        <h2>快捷键设置</h2>
        <button
          class="close-btn"
          @click="close"
        >
          ✕
        </button>
      </div>

      <div class="settings-content">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索快捷键..."
            class="search-input"
          >
        </div>

        <div class="keybindings-list">
          <div
            v-for="category in filteredCategories"
            :key="category.id"
            class="category-section"
          >
            <h3>{{ category.label }}</h3>
            <div
              v-for="cmd in category.commands"
              :key="cmd.id"
              class="keybinding-item"
            >
              <div class="binding-info">
                <span class="binding-description">{{ cmd.description || t(cmd.label) }}</span>
              </div>
              <div
                class="binding-key"
                @click="startRecording(cmd.id)"
              >
                <span
                  v-if="recordingFor === cmd.id"
                  class="recording"
                >
                  按键中...
                </span>
                <span
                  v-else
                  class="key-display"
                >
                  {{ getKeybindingDisplay(cmd.id) || '无' }}
                </span>
                <button
                  v-if="isModified(cmd.id)"
                  class="reset-btn"
                  title="重置为默认"
                  @click.stop="resetBinding(cmd.id)"
                >
                  ↩
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-footer">
          <button
            class="btn secondary"
            @click="resetAll"
          >
            重置全部
          </button>
          <div class="export-import">
            <button
              class="btn secondary"
              @click="handleExportKeybindings"
            >
              导出
            </button>
            <button
              class="btn secondary"
              @click="triggerImport"
            >
              导入
            </button>
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              style="display: none"
              @change="handleImportKeybindings"
            >
          </div>
          <button
            class="btn primary"
            @click="saveAndClose"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { COMMANDS, CATEGORY_LABELS, getPlatformKeybinding } from '@/commands/registry'
import { formatKeybinding, getPlatform } from '@/commands/types'
import { t } from '@/services/i18n'
import type { Keybinding, CommandCategory } from '@/commands/types'
import { getKeybindingManager } from '@/commands/keybinding'
import { usePreferencesStore } from '@/stores/preferences'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save'): void
}>()

const prefsStore = usePreferencesStore()
const searchQuery = ref('')
const recordingFor = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// 用户自定义快捷键覆盖（key = commandId, value = Keybinding）
const customKeybindings = ref<Record<string, Keybinding>>({})

// 所有带快捷键的命令，按类别分组
const categories = computed(() => {
  const categoryMap = new Map<CommandCategory, typeof COMMANDS extends Array<infer T> ? T[] : never>()

  for (const cmd of COMMANDS) {
    if (cmd.hidden) continue
    if (!cmd.keybinding && !customKeybindings.value[cmd.id]) continue

    if (!categoryMap.has(cmd.category)) {
      categoryMap.set(cmd.category, [])
    }
    categoryMap.get(cmd.category)!.push(cmd)
  }

  return Array.from(categoryMap.entries()).map(([catId, commands]) => ({
    id: catId,
    label: t(CATEGORY_LABELS[catId] || catId),
    commands,
  }))
})

const filteredCategories = computed(() => {
  if (!searchQuery.value) {
    return categories.value
  }

  const query = searchQuery.value.toLowerCase()
  return categories.value
    .map(cat => ({
      ...cat,
      commands: cat.commands.filter(cmd =>
        // cmd.label / description 已是 i18n key，搜索按翻译后字符串匹配
        (cmd.description || t(cmd.label)).toLowerCase().includes(query) ||
        t(cmd.label).toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query) ||
        getKeybindingDisplay(cmd.id)?.toLowerCase().includes(query)
      )
    }))
    .filter(cat => cat.commands.length > 0)
})

function getKeybindingDisplay(commandId: string): string | null {
  const platform = getPlatform()
  // 优先使用自定义快捷键
  const custom = customKeybindings.value[commandId]
  if (custom) {
    return formatKeybinding(custom, platform)
  }
  // 回退到平台特定（或默认）快捷键
  const cmd = COMMANDS.find(c => c.id === commandId)
  if (!cmd) return null
  const binding = getPlatformKeybinding(cmd)
  if (binding) {
    return formatKeybinding(binding, platform)
  }
  return null
}

function isModified(commandId: string): boolean {
  return commandId in customKeybindings.value
}

function startRecording(commandId: string) {
  recordingFor.value = commandId
}

function handleKeydown(e: KeyboardEvent) {
  if (recordingFor.value) {
    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      recordingFor.value = null
      return
    }

    // 忽略纯修饰键，等待真正的按键
    const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta', 'OS', 'CapsLock']
    if (modifierKeys.includes(e.key)) {
      return
    }

    const newBinding: Keybinding = {
      key: e.key.toLowerCase(),
      modifiers: {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      }
    }

    customKeybindings.value[recordingFor.value] = newBinding
    recordingFor.value = null
  }
}

function resetBinding(commandId: string) {
  delete customKeybindings.value[commandId]
  // 触发响应式更新
  customKeybindings.value = { ...customKeybindings.value }
}

function resetAll() {
  if (confirm('确定要重置所有快捷键为默认值吗？')) {
    customKeybindings.value = {}
  }
}

function handleExportKeybindings() {
  const data = {
    version: 1,
    keybindings: customKeybindings.value,
  }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'alhagi-keybindings.json'
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  fileInput.value?.click()
}

function handleImportKeybindings(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const json = event.target?.result as string
      const data = JSON.parse(json)
      // 兼容旧格式和新格式
      if (data.version === 1 && data.keybindings) {
        customKeybindings.value = data.keybindings
      } else if (typeof data === 'object' && !data.version) {
        // 旧 useKeybindings 格式转换
        const converted: Record<string, Keybinding> = {}
        for (const [key, val] of Object.entries(data)) {
          const entry = val as { action?: string; key?: string; modifiers?: Keybinding['modifiers'] }
          if (entry.action && entry.key) {
            converted[entry.action] = {
              key: entry.key,
              modifiers: entry.modifiers || {},
            }
          }
        }
        customKeybindings.value = converted
      }
      alert('导入成功！')
    } catch {
      alert('导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
  target.value = ''
}

function saveAndClose() {
  // 保存自定义快捷键到 localStorage
  localStorage.setItem('alhagi-custom-keybindings', JSON.stringify(customKeybindings.value))
  // 将自定义快捷键应用到 KeybindingManager
  applyCustomKeybindings()
  // 注：自定义快捷键自有 localStorage 通道，与偏好系统解耦，不需要走 prefsStore。
  emit('save')
  close()
}

function close() {
  emit('close')
}

// 将自定义快捷键应用到命令系统
function applyCustomKeybindings() {
  const manager = getKeybindingManager()
  manager.setCustomKeybindings(customKeybindings.value)
}

// 从 localStorage 加载自定义快捷键
function loadCustomKeybindings() {
  const saved = localStorage.getItem('alhagi-custom-keybindings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (typeof parsed === 'object') {
        customKeybindings.value = parsed
        applyCustomKeybindings()
      }
    } catch {
      // 静默忽略无效 JSON
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  loadCustomKeybindings()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped lang="scss">
.keyboard-settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: fadeIn 0.2s ease;
}

.keyboard-settings-panel {
  background: var(--panel-bg);
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 800px;
  max-width: 90vw;
  height: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);

  h2 {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary);
  }

  .close-btn {
    border: none;
    background: transparent;
    font-size: 20px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s;

    &:hover {
      background: var(--panel-hover-bg);
    }
  }
}

.settings-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.search-box {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);

  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 13px;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
    }
  }
}

.keybindings-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
}

.category-section {
  margin-bottom: 20px;

  h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 10px 0;
    text-transform: uppercase;
  }
}

.keybinding-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 6px;
  background: var(--panel-hover-bg);
  border-radius: 6px;
  transition: all 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.binding-info {
  flex: 1;

  .binding-description {
    font-size: 13px;
    color: var(--text-primary);
  }
}

.binding-key {
  display: flex;
  align-items: center;
  gap: 8px;

  .key-display {
    padding: 4px 12px;
    background: var(--code-bg);
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      border-color: var(--primary-color);
      background: var(--sidebar-hover-bg);
    }
  }

  .recording {
    padding: 4px 12px;
    background: var(--primary-color);
    border-radius: 4px;
    font-size: 12px;
    color: white;
    animation: pulse 1s ease infinite;
  }

  .reset-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    font-size: 14px;
    border-radius: 4px;
    transition: all 0.15s;

    &:hover {
      background: var(--panel-hover-bg);
      color: var(--primary-color);
    }
  }
}

.settings-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  gap: 12px;
}

.export-import {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;

  &.primary {
    background: var(--primary-color);
    color: white;

    &:hover {
      opacity: 0.9;
    }
  }

  &.secondary {
    background: var(--panel-hover-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);

    &:hover {
      background: var(--sidebar-hover-bg);
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
