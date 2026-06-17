<template>
  <div class="settings-window-root">
    <SettingsPanel />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
/**
 * 设置窗根组件 —— 薄壳。
 *
 * 职责：
 *   1. mount 时调 prefsStore.loadPreferences()
 *      —— 同时订阅 onPreferencesChanged 广播；
 *      —— store 内 watch(theme, { immediate:true }) 自动应用主题；
 *   2. 调 setupEditorTypography()，让设置窗自己 :root 上也有 4 个 CSS 变量
 *      （未来如果设置面板里加"实时预览"块，预览块需要这套变量）。
 *
 * 关闭逻辑：SettingsPanel 内部的关闭按钮直接 window.close()，触发主进程
 * BrowserWindow 'close' 事件，PreferenceStore 持久化几何状态。
 */
import { onMounted } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { setupEditorTypography } from '@/services/typography/EditorTypographyService'
import SettingsPanel from '@/components/Settings/SettingsPanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const prefs = usePreferencesStore()

onMounted(async () => {
  await prefs.loadPreferences()
  setupEditorTypography()
})
</script>

<style scoped lang="scss">
.settings-window-root {
  width: 100vw;
  height: 100vh;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #000);
  overflow: hidden;
}
</style>
