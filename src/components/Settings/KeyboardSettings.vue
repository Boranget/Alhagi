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
            :key="category.name"
            class="category-section"
          >
            <h3>{{ category.name }}</h3>
            <div
              v-for="binding in category.bindings"
              :key="binding.id"
              class="keybinding-item"
            >
              <div class="binding-info">
                <span class="binding-description">{{ binding.description }}</span>
              </div>
              <div
                class="binding-key"
                @click="startRecording(binding)"
              >
                <span
                  v-if="recordingFor === binding.id"
                  class="recording"
                >
                  按键中...
                </span>
                <span
                  v-else
                  class="key-display"
                >
                  {{ formatKeybinding(binding) }}
                </span>
                <button
                  v-if="isModified(binding.id)"
                  class="reset-btn"
                  title="重置为默认"
                  @click.stop="resetBinding(binding.id)"
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
import { useKeybindings } from '@/composables/useKeybindings'
import { DEFAULT_KEYBINDINGS, type Keybinding } from '@/services/keybindingService'
import { usePreferencesStore } from '@/stores/preferences'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save'): void
}>()

const {
  keybindings,
  resetToDefaults,
  exportKeybindings: exportKeybindingsFn,
  importKeybindings: importKeybindingsFn
} = useKeybindings()

const prefsStore = usePreferencesStore()
const searchQuery = ref('')
const recordingFor = ref<string | null>(null)
const tempBindings = ref<Record<string, Keybinding>>({})
const fileInput = ref<HTMLInputElement | null>(null)

const categories = computed(() => {
  const categoryMap = new Map<string, { name: string; bindings: Keybinding[] }>()
  
  keybindings.value.forEach(binding => {
    if (!categoryMap.has(binding.category)) {
      categoryMap.set(binding.category, {
        name: getCategoryName(binding.category),
        bindings: []
      })
    }
    categoryMap.get(binding.category)!.bindings.push(binding)
  })
  
  return Array.from(categoryMap.values())
})

const filteredCategories = computed(() => {
  if (!searchQuery.value) {
    return categories.value
  }
  
  const query = searchQuery.value.toLowerCase()
  return categories.value
    .map(cat => ({
      ...cat,
      bindings: cat.bindings.filter(b =>
        b.description.toLowerCase().includes(query) ||
        b.action.toLowerCase().includes(query) ||
        b.key.toLowerCase().includes(query)
      )
    }))
    .filter(cat => cat.bindings.length > 0)
})

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    file: '文件操作',
    edit: '编辑操作',
    view: '视图操作',
    navigation: '导航操作',
    tools: '工具',
    help: '帮助'
  }
  return names[category] || category
}

function formatKeybinding(binding: Keybinding): string {
  const parts: string[] = []
  if (binding.modifiers.ctrl) parts.push('Ctrl')
  if (binding.modifiers.alt) parts.push('Alt')
  if (binding.modifiers.shift) parts.push('Shift')
  if (binding.modifiers.meta) parts.push('Cmd')
  parts.push(binding.key.toUpperCase())
  return parts.join('+')
}

function isModified(action: string): boolean {
  const current = keybindings.value.find(kb => kb.action === action)
  const temp = tempBindings.value[action]
  if (!current || !temp) return false
  return current.key !== temp.key ||
         JSON.stringify(current.modifiers) !== JSON.stringify(temp.modifiers)
}

function startRecording(binding: Keybinding) {
  recordingFor.value = binding.id
}

function handleKeydown(e: KeyboardEvent) {
  if (recordingFor.value) {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.key === 'Escape') {
      recordingFor.value = null
      return
    }
    
    const newBinding = {
      key: e.key,
      modifiers: {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey
      }
    }
    
    const index = keybindings.value.findIndex(kb => kb.id === recordingFor.value)
    if (index !== -1) {
      keybindings.value[index] = {
        ...keybindings.value[index],
        ...newBinding
      }
    }
    
    recordingFor.value = null
  }
}

function resetBinding(action: string) {
  const defaultBinding = DEFAULT_KEYBINDINGS.find(kb => kb.action === action)
  if (defaultBinding) {
    const index = keybindings.value.findIndex(kb => kb.action === action)
    if (index !== -1) {
      keybindings.value[index] = { ...defaultBinding }
    }
  }
}

function resetAll() {
  if (confirm('确定要重置所有快捷键为默认值吗？')) {
    resetToDefaults()
  }
}

function handleExportKeybindings() {
  const json = exportKeybindingsFn()
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
    const json = event.target?.result as string
    if (importKeybindingsFn(json)) {
      alert('导入成功！')
    } else {
      alert('导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
  target.value = ''
}

function saveAndClose() {
  // 保存到 localStorage
  localStorage.setItem('alhagi-keybindings', JSON.stringify(keybindings.value))
  prefsStore.savePreferences()
  emit('save')
  close()
}

function close() {
  emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // 加载保存的快捷键
  const saved = localStorage.getItem('alhagi-keybindings')
  if (saved) {
    try {
      const imported = JSON.parse(saved) as Keybinding[]
      if (Array.isArray(imported)) {
        keybindings.value = imported
      }
    } catch (e) {
      // Silent fail - invalid JSON in localStorage
    }
  }
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
