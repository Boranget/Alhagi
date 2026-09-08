<template>
  <div class="settings-window-root">
    <SettingsPanel />
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, defineAsyncComponent } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { setupEditorTypography } from '@/services/typography/EditorTypographyService'
import SettingsPanel from '@/components/Settings/SettingsPanel.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useInputDialog } from '@/composables/useInputDialog'
import { useSelectDialog } from '@/composables/useSelectDialog'

const InputDialog = defineAsyncComponent(() => import('@/components/common/InputDialog.vue'))
const SelectDialog = defineAsyncComponent(() => import('@/components/common/SelectDialog.vue'))

const prefs = usePreferencesStore()
const inputDialog = useInputDialog()
const selectDialog = useSelectDialog()

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
