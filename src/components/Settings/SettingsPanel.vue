<template>
  <div
    class="settings-panel-root"
    tabindex="-1"
    @keyup.esc="close"
  >
    <div class="settings-panel">
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
              <select
                :value="prefsStore.launchMode"
                @change="onSelect('launchMode', $event)"
              >
                <option value="last-session">恢复上次状态</option>
                <option value="welcome">欢迎页</option>
                <option value="empty">空白编辑器</option>
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
                  type="checkbox"
                  :checked="prefsStore.autoSave"
                  @change="onCheckbox('autoSave', $event)"
                >
                启用自动保存
              </label>
            </div>
            <div class="setting-item">
              <label>自动保存间隔 (秒)</label>
              <input
                type="number"
                min="1"
                max="300"
                :value="prefsStore.autoSaveInterval"
                @change="onNumber('autoSaveInterval', $event)"
              >
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
              <select
                :value="prefsStore.theme"
                @change="onSelect('theme', $event)"
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="system">跟随系统</option>
              </select>
            </div>

            <h3>界面元素</h3>
            <div class="setting-item">
              <label>
                <input
                  type="checkbox"
                  :checked="prefsStore.hideScrollBars"
                  @change="onCheckbox('hideScrollBars', $event)"
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
            <h3>字体（所见即所得视图）</h3>
            <div class="setting-item">
              <label>字体大小</label>
              <input
                type="range"
                :min="EDITOR.MIN_FONT_SIZE"
                :max="EDITOR.MAX_FONT_SIZE"
                step="1"
                :value="prefsStore.fontSize"
                @input="onNumber('fontSize', $event)"
              >
              <span class="setting-value">{{ prefsStore.fontSize }} px</span>
            </div>
            <div class="setting-item">
              <label>行高</label>
              <input
                type="range"
                :min="EDITOR.MIN_LINE_HEIGHT"
                :max="EDITOR.MAX_LINE_HEIGHT"
                step="0.1"
                :value="prefsStore.lineHeight"
                @input="onNumber('lineHeight', $event)"
              >
              <span class="setting-value">{{ prefsStore.lineHeight.toFixed(1) }}</span>
            </div>

            <h3>字体（源码模式）</h3>
            <div class="setting-item">
              <label>字体大小</label>
              <input
                type="range"
                :min="EDITOR.MIN_FONT_SIZE"
                :max="EDITOR.MAX_FONT_SIZE"
                step="1"
                :value="prefsStore.sourceFontSize"
                @input="onNumber('sourceFontSize', $event)"
              >
              <span class="setting-value">{{ prefsStore.sourceFontSize }} px</span>
            </div>
            <div class="setting-item">
              <label>行高</label>
              <input
                type="range"
                :min="EDITOR.MIN_LINE_HEIGHT"
                :max="EDITOR.MAX_LINE_HEIGHT"
                step="0.1"
                :value="prefsStore.sourceLineHeight"
                @input="onNumber('sourceLineHeight', $event)"
              >
              <span class="setting-value">{{ prefsStore.sourceLineHeight.toFixed(1) }}</span>
            </div>

            <h3>缩放</h3>
            <div class="setting-item">
              <label>界面缩放</label>
              <input
                type="number"
                min="50"
                max="200"
                :value="prefsStore.zoom"
                @change="onNumber('zoom', $event)"
              >
              <span class="zoom-percent">{{ prefsStore.zoom }}%</span>
            </div>

            <h3>行尾符</h3>
            <div class="setting-item">
              <label>默认行尾符</label>
              <select
                :value="prefsStore.lineEnding"
                @change="onSelect('lineEnding', $event)"
              >
                <option value="lf">LF (Unix)</option>
                <option value="crlf">CRLF (Windows)</option>
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
              <select
                :value="prefsStore.imageInsertMode"
                @change="onSelect('imageInsertMode', $event)"
              >
                <option value="keep-original">{{ t('settings.keepOriginal') }}</option>
                <option value="copy-absolute">{{ t('settings.copyAbsolute') }}</option>
                <option value="copy-relative">{{ t('settings.copyRelative') }}</option>
              </select>
            </div>

            <!-- 复制到全局目录设置 -->
            <div
              v-show="prefsStore.imageInsertMode === 'copy-absolute'"
              class="setting-item vertical"
            >
              <label>全局图片目录</label>
              <div class="path-help">
                <p class="help-text">
                  设置全局图片保存位置，所有文档粘贴的图片都将保存到此目录。留空则使用默认路径（文档目录/alhagi/images）。
                </p>
                <input
                  type="text"
                  placeholder="留空使用默认路径"
                  :value="prefsStore.imageStoragePath"
                  @change="onString('imageStoragePath', $event)"
                >
                <div class="path-actions">
                  <button
                    type="button"
                    class="btn-small"
                    @click="pickImageStorageDir"
                  >
                    选择目录...
                  </button>
                  <button
                    type="button"
                    class="btn-small"
                    :disabled="!prefsStore.imageStoragePath"
                    @click="showImageStorageInFolder"
                  >
                    在文件夹中打开
                  </button>
                </div>
              </div>
            </div>

            <!-- 复制到相对目录设置 -->
            <div
              v-show="prefsStore.imageInsertMode === 'copy-relative'"
              class="setting-item vertical"
            >
              <label>相对图片目录</label>
              <div class="path-help">
                <p class="help-text">
                  设置相对于当前文档的图片保存位置。留空则使用默认路径（assets）。
                </p>
                <p class="help-label">可用变量：</p>
                <div class="path-variables">
                  <code>{filename}</code> - 原文件名（不含扩展名）
                  <code>{filedir}</code> - 当前文档所在目录
                  <code>{date}</code> - 当前日期（格式：2024-01-15）
                  <code>{time}</code> - 当前时间（格式：14-30-00）
                  <code>{datetime}</code> - 日期时间组合
                </div>
                <p class="help-label">示例：</p>
                <div class="path-examples">
                  <p><code>assets</code> - 保存到文档同目录的 assets 文件夹</p>
                  <p><code>images/{date}</code> - 按日期分组的图片文件夹</p>
                  <p><code>assets/{filename}_{datetime}</code> - 带时间戳的文件名</p>
                </div>
                <input
                  type="text"
                  placeholder="assets"
                  :value="prefsStore.imageStoragePath"
                  @change="onString('imageStoragePath', $event)"
                >
              </div>
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
              <select
                :value="prefsStore.language"
                @change="onSelect('language', $event)"
              >
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
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
                  type="checkbox"
                  :checked="prefsStore.devToolsOnStartup"
                  @change="onCheckbox('devToolsOnStartup', $event)"
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
</template>

<script setup lang="ts">
/**
 * SettingsPanel —— Single-Writer 模式（仿 Muya）。
 *
 * 严格规则：所有 UI 控件用 `:value` / `:checked` + `@change` / `@input` 单向绑定，
 * **绝不**用 v-model 直绑 prefsStore 字段。回写经过 prefsStore.setOne(key, value)
 * → IPC → 主进程写盘 → 广播给所有窗口（含本窗）→ applyPatch 更新本地 ref。
 *
 * 这就消除了 v-model 直绑 ref 时常见的"绕过副作用"、"批量灌入风暴"、
 * "广播回写循环"等一类 bug。
 */

import { ref } from 'vue'
import { usePreferencesStore, type Preferences } from '@/stores/preferences'
import { t } from '@/services/i18n'
import { electronService } from '@/services/electron/ElectronService'
import { EDITOR } from '@/constants'
import KeyboardSettings from './KeyboardSettings.vue'

interface SettingsSection {
  id: string
  label: string
}

const prefsStore = usePreferencesStore()
const showKeyboardSettings = ref(false)

const sections: SettingsSection[] = [
  { id: 'general', label: '通用' },
  { id: 'save', label: '保存' },
  { id: 'appearance', label: '外观' },
  { id: 'editor', label: '编辑器' },
  { id: 'images', label: '图片' },
  { id: 'language', label: '语言' },
  { id: 'keyboard', label: '快捷键' },
  { id: 'developer', label: '开发' }
]

const activeSection = ref('general')

// —————————————— Single-Writer 写入助手 ——————————————
// 所有控件回调最终走 prefsStore.setOne。三个 helper 处理 input 类型差异。

function onCheckbox<K extends keyof Preferences>(key: K, event: Event): void {
  const target = event.target as HTMLInputElement
  prefsStore.setOne(key, target.checked as Preferences[K])
}

function onNumber<K extends keyof Preferences>(key: K, event: Event): void {
  const target = event.target as HTMLInputElement
  const v = Number(target.value)
  if (!Number.isFinite(v)) return
  prefsStore.setOne(key, v as Preferences[K])
}

function onString<K extends keyof Preferences>(key: K, event: Event): void {
  const target = event.target as HTMLInputElement
  prefsStore.setOne(key, target.value as Preferences[K])
}

function onSelect<K extends keyof Preferences>(key: K, event: Event): void {
  const target = event.target as HTMLSelectElement
  prefsStore.setOne(key, target.value as Preferences[K])
}

/**
 * 关闭设置窗 —— 现在 SettingsPanel 是独立 BrowserWindow 的根组件。
 * 直接 window.close() 触发 BrowserWindow 'close'，由 SettingsWindowManager 持久化几何状态后销毁。
 */
function close() {
  window.close()
}

function openKeyboardSettings() {
  showKeyboardSettings.value = true
}

/** 调用主进程 dialog.showOpenDialog 让用户选目录，回写到 imageStoragePath */
async function pickImageStorageDir() {
  const api = electronService.getAPI()
  if (!api) return
  const resp = await api.selectDirectory()
  if (resp.success && resp.data) {
    prefsStore.setOne('imageStoragePath', resp.data)
  }
}

async function showImageStorageInFolder() {
  if (!prefsStore.imageStoragePath) return
  const api = electronService.getAPI()
  if (!api) return
  await api.showInFolder(prefsStore.imageStoragePath)
}
</script>

<style scoped lang="scss">
/* 根容器：填满整个 BrowserWindow（设置窗是独立窗口，不是 modal） */
.settings-panel-root {
  width: 100%;
  height: 100%;
  display: flex;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.settings-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--panel-bg, var(--bg-primary));
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  /* 设置窗 BrowserWindow 是 frame:false（无原生标题栏），整条 header 充当
   * 自绘标题栏，可拖动窗口。内部交互元素必须 no-drag 还原点击。 */
  -webkit-app-region: drag;
  user-select: none;

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
    -webkit-app-region: no-drag;

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

    .zoom-percent {
      font-size: 13px;
      color: var(--text-secondary);
      margin-left: 8px;
    }

    .setting-value {
      font-size: 13px;
      color: var(--text-secondary);
      margin-left: 8px;
      min-width: 56px;
      text-align: right;
      font-variant-numeric: tabular-nums;
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

.setting-item.vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.path-help {
  width: 100%;
  background: var(--panel-hover-bg);
  border-radius: 6px;
  padding: 12px;

  .help-text {
    margin: 0 0 12px 0;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .help-label {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .path-variables {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;

    code {
      background: var(--input-bg);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      color: var(--primary-color);
    }
  }

  .path-examples {
    margin-bottom: 12px;

    p {
      margin: 4px 0;
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    code {
      background: var(--input-bg);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      color: var(--primary-color);
    }
  }

  input[type="text"] {
    width: 100%;
    box-sizing: border-box;
  }

  .path-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;

    .btn-small {
      padding: 4px 10px;
      font-size: 12px;
      background: var(--input-bg);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;

      &:hover:not(:disabled) {
        background: var(--bg-hover);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }
  }
}
</style>