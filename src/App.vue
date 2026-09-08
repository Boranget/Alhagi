<template>
  <div
    class="app-container"
    :class="{ 'is-fullscreen': isFullscreen, 'is-sticky-note': layoutStore.isStickyNoteMode, 'is-immersive': layoutStore.isImmersiveMode }"
  >
    <div
      v-if="layoutStore.isImmersiveMode"
      class="immersive-tip"
    >
      按 Esc 退出沉浸模式
    </div>
    <div class="app-content">
      <Transition name="sidebar-slide">
        <EnhancedSidebar
          v-if="layoutStore.showSidebar"
          @open-settings="openSettingsWindow"
        />
      </Transition>
      <div class="editor-wrapper">
        <TabBar v-if="layoutStore.showTabBar && tabsStore.tabs.size > 0" />
        <div class="editor-area">
          <EditorContainer v-if="tabsStore.tabs.size > 0" />
          <Welcome v-else />
        </div>
      </div>
    </div>
    <Transition name="statusbar-slide">
      <StatusBar v-if="layoutStore.showStatusBar" />
    </Transition>
    <CommandPalette
      :visible="showCommandPalette"
      @close="showCommandPalette = false"
    />
    <ShortcutsDialog
      :visible="showShortcuts"
      @close="showShortcuts = false"
    />
    <ConfirmDialog />
    <InputDialog
      :visible="inputDialog.state.visible"
      :title="inputDialog.state.title"
      :default-value="inputDialog.state.defaultValue"
      :placeholder="inputDialog.state.placeholder"
      :confirm-text="inputDialog.state.confirmText"
      :cancel-text="inputDialog.state.cancelText"
      @confirm="inputDialog.confirm"
      @cancel="inputDialog.cancel"
    />
    <SelectDialog
      :visible="selectDialog.state.visible"
      :title="selectDialog.state.title"
      :options="selectDialog.state.options"
      :cancel-text="selectDialog.state.cancelText"
      @select="selectDialog.onSelect"
      @cancel="selectDialog.cancel"
    />
    <Toast ref="toastRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useLayoutStore } from '@/stores/layout'
import { useApp } from '@/composables/useApp'
import { useToast } from '@/composables/useToast'
import { useInputDialog } from '@/composables/useInputDialog'
import { useSelectDialog } from '@/composables/useSelectDialog'
import { eventBus, AppEvents } from '@/events/eventBus'
import TabBar from '@/components/Tabs/TabBar.vue'
import EnhancedSidebar from '@/components/Sidebar/EnhancedSidebar.vue'
import StatusBar from '@/components/StatusBar/StatusBar.vue'
import Welcome from '@/components/Welcome/Welcome.vue'

// 按需对话框：仅在用户触发时才加载，减小首屏 bundle 体积
const CommandPalette = defineAsyncComponent(() => import('@/components/CommandPalette/CommandPalette.vue'))
const ShortcutsDialog = defineAsyncComponent(() => import('@/components/Shortcuts/ShortcutsDialog.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/components/ConfirmDialog.vue'))
const InputDialog = defineAsyncComponent(() => import('@/components/common/InputDialog.vue'))
const SelectDialog = defineAsyncComponent(() => import('@/components/common/SelectDialog.vue'))
const Toast = defineAsyncComponent(() => import('@/components/Toast/Toast.vue'))
// 编辑器异步加载（P2-9）：仅当有打开文件时拉取 milkdown/crepe + codemirror，
// 让 Welcome 页面首屏体积减小 ~1MB（gz ~300KB）。
const EditorContainer = defineAsyncComponent(() => import('@/components/Editor/EditorContainer.vue'))

const tabsStore = useTabsStore()
const prefsStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const { isFullscreen, initializeApp } = useApp()
const inputDialog = useInputDialog()
const selectDialog = useSelectDialog()

const showCommandPalette = ref(false)
const showShortcuts = ref(false)
const toastRef = ref<InstanceType<typeof import('@/components/Toast/Toast.vue').default> | null>(null)

// 连接全局 toast
const { toastRef: globalToastRef } = useToast()
watch(toastRef, (val) => { globalToastRef.value = val })

/**
 * 主窗请求打开设置窗。设置已重构为独立 BrowserWindow（settings.html 入口）：
 * 主窗调 IPC，主进程的 SettingsWindowManager 创建/聚焦设置窗，
 * 之后两边通过 PREFERENCES.CHANGED 广播双向同步偏好。
 */
function openSettingsWindow() {
  if (window.electronAPI?.openSettings) {
    window.electronAPI.openSettings().catch(() => {
      // 静默失败：用户可以重试
    })
  }
}

let cleanup: (() => void) | null = null
const eventUnsubscribers: (() => void)[] = []

function exitImmersiveMode() {
  if (!layoutStore.isImmersiveMode) return
  window.electronAPI?.setWindowMode('normal')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    exitImmersiveMode()
  }
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -1 : 1
    if (delta > 0) {
      prefsStore.zoomIn()
    } else {
      prefsStore.zoomOut()
    }
  }
}

onMounted(async () => {
  cleanup = await initializeApp()

  window.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('keydown', handleKeydown)

  // 全局对话框开关订阅 —— dispatcher 通过 eventBus 触发
  eventUnsubscribers.push(
    eventBus.on(AppEvents.SHOW_COMMAND_PALETTE, () => {
      showCommandPalette.value = !showCommandPalette.value
    }),
  )
  eventUnsubscribers.push(
    eventBus.on(AppEvents.SHOW_SHORTCUTS, () => {
      showShortcuts.value = true
    }),
  )

  const stopModeWatch = window.electronAPI?.onWindowModeChanged((mode) => {
    layoutStore.applyWindowMode(mode)
  })
  if (stopModeWatch) eventUnsubscribers.push(stopModeWatch)
})

onUnmounted(() => {
  window.removeEventListener('wheel', handleWheel)
  window.removeEventListener('keydown', handleKeydown)
  for (const unsubscribe of eventUnsubscribers) unsubscribe()
  eventUnsubscribers.length = 0

  if (cleanup) {
    cleanup()
  }
})
</script>

<style scoped lang="scss">
.immersive-tip {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 2500;
  transform: translateX(-50%);
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--panel-bg);
  color: var(--text-secondary);
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  pointer-events: none;
}

.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  min-height: 0;
}

.app-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.editor-area {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ----------------------------------------------------------
 * 侧边栏 / 状态栏 显隐过渡（GPU 合成层动画）
 *
 * 性能约束（必须遵守）：
 *   ✔ 只动画 `transform` 和 `opacity` —— 合成线程内完成，0 layout、0 paint
 *   ✗ 不碰 width/height/margin/padding（引起 layout 重排，每帧几十 ms）
 *   ✗ 不碰 box-shadow/background（引起 paint，每帧几 ms）
 *
 * 曲线选择：
 *   放弃原来 180 ms + 激进 ease-out（刚冲就停，硬撞墙感）。
 *   改用 250 ms + `cubic-bezier(0.25, 0.1, 0.25, 1)` —— Apple HIG
 *   "standard ease-in-out" 的典型取值：前 25% 匀加速、后 50% 匀减速、
 *   终段 25% 极慢靠边。人眼能轻易追踪的运动轨迹 → 感知上"更顺"。
 *
 * 侧边栏比状态栏稍快 30 ms（用户更频繁交互侧栏；状态栏是边角操作）。
 *
 * 无障碍：`prefers-reduced-motion` 用户跳过动画，直接瞬切（保持可用性）。
 * ---------------------------------------------------------- */

.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition:
    transform 220ms cubic-bezier(0.25, 0.1, 0.25, 1),
    opacity 220ms cubic-bezier(0.25, 0.1, 0.25, 1);
  will-change: transform, opacity;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.statusbar-slide-enter-active,
.statusbar-slide-leave-active {
  transition:
    transform 250ms cubic-bezier(0.25, 0.1, 0.25, 1),
    opacity 250ms cubic-bezier(0.25, 0.1, 0.25, 1);
  will-change: transform, opacity;
}

.statusbar-slide-enter-from,
.statusbar-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-slide-enter-active,
  .sidebar-slide-leave-active,
  .statusbar-slide-enter-active,
  .statusbar-slide-leave-active {
    transition-duration: 0ms !important;
  }
}
</style>
