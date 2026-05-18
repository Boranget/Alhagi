<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="settings-panel-overlay"
      tabindex="-1"
      @click="handleOverlayClick"
      @keyup.esc="close"
    >
      <div
        class="settings-panel"
        @click.stop
      >
        <div class="settings-header">
          <h2>设置</h2>
          <button
            class="close-btn"
            @click="close"
          >
            关闭
          </button>
        </div>
      
        <div class="settings-content">
          <div class="settings-sidebar">
            <button
              v-for="section in sections"
              :key="section.id"
              class="sidebar-item"
              :class="{ active: activeSection === section.id }"
              @click="activeSection = section.id"
            >
              {{ section.label }}
            </button>
          </div>
          
          <div class="settings-main">
            <!-- 启动行为设置 -->
            <div
              v-show="activeSection === 'general'"
              class="settings-section"
            >
              <h3>启动行为</h3>
              <div class="setting-item">
                <label>启动模式</label>
                <select v-model="prefsStore.launchMode">
                  <option value="restore">
                    恢复上次状态
                  </option>
                  <option value="welcome">
                    欢迎页
                  </option>
                  <option value="blank">
                    空白编辑器
                  </option>
                </select>
              </div>
            </div>
            
            <!-- 保存设置 -->
            <div
              v-show="activeSection === 'save'"
              class="settings-section"
            >
              <h3>自动保存</h3>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.autoSave"
                    type="checkbox"
                  >
                  启用自动保存
                </label>
              </div>
              <div class="setting-item">
                <label>自动保存间隔 (秒)</label>
                <input
                  v-model.number="prefsStore.autoSaveInterval"
                  type="number"
                  min="1"
                  max="300"
                >
              </div>
            </div>
            
            <!-- 文件行为设置 -->
            <div
              v-show="activeSection === 'files'"
              class="settings-section"
            >
              <h3>文件打开行为</h3>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.openFileInNewWindow"
                    type="checkbox"
                  >
                  在新窗口中打开文件
                </label>
              </div>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.openFolderInNewWindow"
                    type="checkbox"
                  >
                  在新窗口中打开文件夹
                </label>
              </div>
            </div>
            
            <!-- 界面设置 -->
            <div
              v-show="activeSection === 'appearance'"
              class="settings-section"
            >
              <h3>主题</h3>
              <div class="setting-item">
                <label>主题</label>
                <select v-model="prefsStore.theme">
                  <option value="light">
                    浅色
                  </option>
                  <option value="dark">
                    深色
                  </option>
                  <option value="system">
                    跟随系统
                  </option>
                </select>
              </div>
              
              <h3>界面元素</h3>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.showSidebar"
                    type="checkbox"
                  >
                  显示侧边栏
                </label>
              </div>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.showStatusBar"
                    type="checkbox"
                  >
                  显示状态栏
                </label>
              </div>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.hideScrollBars"
                    type="checkbox"
                  >
                  隐藏滚动条
                </label>
              </div>
            </div>
            
            <!-- 编辑器设置 -->
            <div
              v-show="activeSection === 'editor'"
              class="settings-section"
            >
              <h3>编辑增强</h3>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.typewriterMode"
                    type="checkbox"
                  >
                  打字机模式
                </label>
              </div>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.focusMode"
                    type="checkbox"
                  >
                  专注模式
                </label>
              </div>
              
              <h3>字体</h3>
              <div class="setting-item">
                <label>字体大小</label>
                <input
                  v-model.number="prefsStore.fontSize"
                  type="number"
                  min="8"
                  max="32"
                >
              </div>
              
              <h3>行尾符</h3>
              <div class="setting-item">
                <label>默认行尾符</label>
                <select v-model="prefsStore.lineEnding">
                  <option value="lf">
                    LF (Unix)
                  </option>
                  <option value="crlf">
                    CRLF (Windows)
                  </option>
                </select>
              </div>
            </div>
            
            <!-- 图片设置 -->
            <div
              v-show="activeSection === 'images'"
              class="settings-section"
            >
              <h3>图片插入</h3>
              <div class="setting-item">
                <label>默认插入模式</label>
                <select v-model="prefsStore.imageInsertMode">
                  <option value="keep-original">
                    保留原始路径
                  </option>
                  <option value="copy-absolute">
                    复制并使用绝对路径
                  </option>
                  <option value="copy-relative">
                    复制并使用相对路径
                  </option>
                </select>
              </div>
              <div class="setting-item">
                <label>图片保存目录</label>
                <input
                  v-model="prefsStore.imageStoragePath"
                  type="text"
                  placeholder="路径"
                >
              </div>
            </div>
            
            <!-- 语言设置 -->
            <div
              v-show="activeSection === 'language'"
              class="settings-section"
            >
              <h3>语言</h3>
              <div class="setting-item">
                <label>界面语言</label>
                <select v-model="prefsStore.language">
                  <option value="zh-CN">
                    简体中文
                  </option>
                  <option value="en">
                    English
                  </option>
                </select>
              </div>
            </div>
            
            <!-- 快捷键设置 -->
            <div
              v-show="activeSection === 'keyboard'"
              class="settings-section"
            >
              <h3>快捷键</h3>
              <div class="setting-item">
                <button
                  class="open-keyboard-btn"
                  @click="openKeyboardSettings"
                >
                  打开快捷键设置
                </button>
              </div>
            </div>
            
            <!-- 开发设置 -->
            <div
              v-show="activeSection === 'developer'"
              class="settings-section"
            >
              <h3>开发工具</h3>
              <div class="setting-item">
                <label>
                  <input
                    v-model="prefsStore.devToolsOnStartup"
                    type="checkbox"
                  >
                  启动时打开开发者工具
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
      <KeyboardSettings 
        v-if="showKeyboardSettings"
        @close="showKeyboardSettings = false"
        @save="showKeyboardSettings = false"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import KeyboardSettings from './KeyboardSettings.vue'

interface SettingsSection {
  id: string
  label: string
}

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const prefsStore = usePreferencesStore()
const showKeyboardSettings = ref(false)

const sections: SettingsSection[] = [
  { id: 'general', label: '通用' },
  { id: 'save', label: '保存' },
  { id: 'files', label: '文件' },
  { id: 'appearance', label: '外观' },
  { id: 'editor', label: '编辑器' },
  { id: 'images', label: '图片' },
  { id: 'language', label: '语言' },
  { id: 'keyboard', label: '快捷键' },
  { id: 'developer', label: '开发' }
]

const activeSection = ref('general')

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close()
  }
}

function close() {
  emit('close')
}

function openKeyboardSettings() {
  showKeyboardSettings.value = true
}
</script>

<style scoped lang="scss">
.settings-panel-overlay {
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
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.settings-panel {
  background: var(--panel-bg);
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 700px;
  max-width: 90vw;
  height: 500px;
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
    font-size: 16px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px 12px;
    border-radius: 4px;
    transition: all 0.15s;
    
    &:hover {
      background: var(--panel-hover-bg);
    }
  }
}

.settings-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-sidebar {
  width: 150px;
  background: var(--panel-bg);
  border-right: 1px solid var(--border-color);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.sidebar-item {
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  text-align: left;
  transition: all 0.15s;
  
  &:hover {
    background: var(--panel-hover-bg);
    color: var(--text-primary);
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
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    
    label {
      font-size: 13px;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    input[type="text"],
    input[type="number"],
    select {
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--input-bg);
      color: var(--text-primary);
      font-size: 13px;
      min-width: 150px;
      
      &:focus {
        outline: none;
        border-color: var(--primary-color);
      }
    }
  }
}

.open-keyboard-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--primary-color);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover {
    opacity: 0.9;
  }
}
</style>
