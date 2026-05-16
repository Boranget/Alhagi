<template>
  <div class="settings-panel" v-if="isOpen" @click.self="close">
    <div class="settings-container">
      <div class="settings-header">
        <h2>设置</h2>
        <button class="close-btn" @click="close">×</button>
      </div>
      <div class="settings-content">
        <div class="settings-sidebar">
          <button
            v-for="section in sections"
            :key="section.id"
            class="section-btn"
            :class="{ active: activeSection === section.id }"
            @click="activeSection = section.id"
          >
            {{ section.icon }} {{ section.label }}
          </button>
        </div>
        <div class="settings-main">
          <div v-show="activeSection === 'editor'" class="settings-section">
            <h3>编辑器设置</h3>
            <div class="setting-item">
              <label>字体大小</label>
              <input v-model.number="prefs.fontSize" type="number" min="10" max="24" />
            </div>
            <div class="setting-item">
              <label>行高</label>
              <input v-model.number="prefs.lineHeight" type="number" min="1" max="3" step="0.1" />
            </div>
            <div class="setting-item">
              <label>
                <input v-model="prefs.wordWrap" type="checkbox" />
                <span>自动换行</span>
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input v-model="prefs.hideScrollbar" type="checkbox" />
                <span>隐藏滚动条</span>
              </label>
            </div>
          </div>
          
          <div v-show="activeSection === 'file'" class="settings-section">
            <h3>文件设置</h3>
            <div class="setting-item">
              <label>
                <input v-model="prefs.autoSave" type="checkbox" />
                <span>自动保存</span>
              </label>
            </div>
            <div v-if="prefs.autoSave" class="setting-item">
              <label>自动保存延迟 (毫秒)</label>
              <input v-model.number="prefs.autoSaveDelay" type="number" min="500" max="10000" step="100" />
            </div>
            <div class="setting-item">
              <label>文件编码</label>
              <select v-model="prefs.encoding">
                <option value="utf-8">UTF-8</option>
                <option value="gbk">GBK</option>
                <option value="gb2312">GB2312</option>
              </select>
            </div>
          </div>
          
          <div v-show="activeSection === 'appearance'" class="settings-section">
            <h3>外观设置</h3>
            <div class="setting-item">
              <label>主题</label>
              <div class="theme-options">
                <button
                  class="theme-btn"
                  :class="{ active: prefs.theme === 'light' }"
                  @click="prefsStore.setTheme('light')"
                >
                  ☀️ 浅色
                </button>
                <button
                  class="theme-btn"
                  :class="{ active: prefs.theme === 'dark' }"
                  @click="prefsStore.setTheme('dark')"
                >
                  🌙 深色
                </button>
              </div>
            </div>
            <div class="setting-item">
              <label>语言</label>
              <select v-model="prefs.language">
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </div>
            <div class="setting-item">
              <label>
                <input v-model="prefs.showSidebar" type="checkbox" />
                <span>显示侧边栏</span>
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input v-model="prefs.showStatusbar" type="checkbox" />
                <span>显示状态栏</span>
              </label>
            </div>
          </div>
          
          <div v-show="activeSection === 'behavior'" class="settings-section">
            <h3>行为设置</h3>
            <div class="setting-item">
              <label>
                <input v-model="prefs.typewriterMode" type="checkbox" />
                <span>打字机模式</span>
              </label>
              <p class="setting-desc">光标保持在屏幕中央</p>
            </div>
            <div class="setting-item">
              <label>
                <input v-model="prefs.focusMode" type="checkbox" />
                <span>专注模式</span>
              </label>
              <p class="setting-desc">高亮当前段落，弱化其他内容</p>
            </div>
          </div>
          
          <div v-show="activeSection === 'shortcuts'" class="settings-section">
            <h3>快捷键设置</h3>
            <div class="shortcuts-list">
              <div v-for="shortcut in shortcuts" :key="shortcut.action" class="shortcut-item">
                <span class="shortcut-action">{{ shortcut.label }}</span>
                <kbd class="shortcut-key">{{ shortcut.key }}</kbd>
              </div>
            </div>
            <button class="action-btn" @click="resetShortcuts">恢复默认快捷键</button>
          </div>
        </div>
      </div>
      <div class="settings-footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button class="btn btn-primary" @click="saveSettings">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const prefsStore = usePreferencesStore()

const activeSection = ref('editor')

const sections = [
  { id: 'editor', label: '编辑器', icon: '📝' },
  { id: 'file', label: '文件', icon: '📁' },
  { id: 'appearance', label: '外观', icon: '🎨' },
  { id: 'behavior', label: '行为', icon: '⚙️' },
  { id: 'shortcuts', label: '快捷键', icon: '⌨️' }
]

const prefs = reactive({
  fontSize: 14,
  lineHeight: 1.6,
  wordWrap: true,
  hideScrollbar: false,
  autoSave: true,
  autoSaveDelay: 1000,
  encoding: 'utf-8',
  theme: 'light' as 'light' | 'dark',
  language: 'zh-CN' as 'zh-CN' | 'en-US',
  showSidebar: true,
  showStatusbar: true,
  typewriterMode: false,
  focusMode: false
})

const shortcuts = [
  { action: 'newFile', label: '新建文件', key: 'Ctrl+N' },
  { action: 'openFile', label: '打开文件', key: 'Ctrl+O' },
  { action: 'save', label: '保存', key: 'Ctrl+S' },
  { action: 'saveAs', label: '另存为', key: 'Ctrl+Shift+S' },
  { action: 'undo', label: '撤销', key: 'Ctrl+Z' },
  { action: 'redo', label: '重做', key: 'Ctrl+Shift+Z' },
  { action: 'find', label: '查找', key: 'Ctrl+F' },
  { action: 'replace', label: '替换', key: 'Ctrl+H' },
  { action: 'toggleSidebar', label: '切换侧边栏', key: 'Ctrl+B' },
  { action: 'fullscreen', label: '全屏', key: 'F11' }
]

watch(() => prefsStore, (newPrefs) => {
  Object.assign(prefs, {
    fontSize: newPrefs.wordWrap ? 14 : 14,
    lineHeight: 1.6,
    wordWrap: newPrefs.wordWrap,
    hideScrollbar: newPrefs.hideScrollbar,
    autoSave: newPrefs.autoSave,
    autoSaveDelay: newPrefs.autoSaveDelay,
    theme: newPrefs.theme,
    language: newPrefs.language,
    showSidebar: newPrefs.showSidebar,
    showStatusbar: newPrefs.showStatusbar,
    typewriterMode: newPrefs.typewriterMode,
    focusMode: newPrefs.focusMode
  })
}, { immediate: true })

function saveSettings() {
  prefsStore.setAutoSave(prefs.autoSave)
  prefsStore.setAutoSaveDelay(prefs.autoSaveDelay)
  prefsStore.setHideScrollbar(prefs.hideScrollbar)
  prefsStore.setTypewriterMode(prefs.typewriterMode)
  prefsStore.setFocusMode(prefs.focusMode)
  prefsStore.setShowStatusbar(prefs.showStatusbar)
  prefsStore.setShowSidebar(prefs.showSidebar)
  prefsStore.setWordWrap(prefs.wordWrap)
  prefsStore.setTheme(prefs.theme)
  prefsStore.setLanguage(prefs.language)
  
  prefsStore.savePreferences()
  close()
}

function resetShortcuts() {
  console.log('Reset shortcuts to default')
}

function close() {
  emit('close')
}
</script>

<style scoped lang="scss">
.settings-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-container {
  width: 800px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--bg-primary);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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
    font-weight: 600;
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
}

.settings-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-sidebar {
  width: 180px;
  padding: 12px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.section-btn {
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  transition: all 0.15s;

  &:hover {
    background: var(--bg-primary);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}

.settings-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.settings-section {
  h3 {
    margin: 0 0 20px;
    font-size: 16px;
    font-weight: 600;
  }
}

.setting-item {
  margin-bottom: 16px;

  > label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: 6px;

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
  }

  input[type="number"],
  input[type="text"],
  select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 13px;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
    }
  }
}

.setting-desc {
  margin: 4px 0 0 24px;
  font-size: 11px;
  color: var(--text-secondary);
}

.theme-options {
  display: flex;
  gap: 8px;
}

.theme-btn {
  flex: 1;
  padding: 10px;
  border: 2px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.15s;

  &:hover {
    border-color: var(--primary-color);
  }

  &.active {
    border-color: var(--primary-color);
    background: var(--primary-color);
    color: white;
  }
}

.shortcuts-list {
  margin-bottom: 16px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.shortcut-action {
  font-size: 13px;
  color: var(--text-primary);
}

.shortcut-key {
  padding: 4px 8px;
  background: var(--code-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;

  &.btn-primary {
    background: var(--primary-color);
    color: white;

    &:hover {
      opacity: 0.9;
    }
  }

  &.btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);

    &:hover {
      background: var(--border-color);
    }
  }
}
</style>
