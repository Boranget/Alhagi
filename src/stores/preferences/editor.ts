import { defineStore } from 'pinia'
import { ref } from 'vue'
import { EDITOR } from '@/constants'

export const useEditorPreferencesStore = defineStore('preferences-editor', () => {
  // 编辑器配置
  const fontSize = ref<number>(EDITOR.DEFAULT_FONT_SIZE)
  const lineHeight = ref<number>(EDITOR.DEFAULT_LINE_HEIGHT)
  const sourceFontSize = ref<number>(EDITOR.DEFAULT_SOURCE_FONT_SIZE)
  const sourceLineHeight = ref<number>(EDITOR.DEFAULT_SOURCE_LINE_HEIGHT)
  const zoom = ref<number>(100)
  const wordWrap = ref<boolean>(true)
  const wordCountDisplayType = ref<'raw' | 'rendered'>('raw')

  // 自动保存
  const autoSave = ref<boolean>(true)
  const autoSaveInterval = ref<number>(30000)

  function applyPatch(patch: Partial<{
    fontSize: number
    lineHeight: number
    sourceFontSize: number
    sourceLineHeight: number
    zoom: number
    wordWrap: boolean
    wordCountDisplayType: 'raw' | 'rendered'
    autoSave: boolean
    autoSaveInterval: number
  }>): void {
    if (patch.fontSize !== undefined) fontSize.value = patch.fontSize
    if (patch.lineHeight !== undefined) lineHeight.value = patch.lineHeight
    if (patch.sourceFontSize !== undefined) sourceFontSize.value = patch.sourceFontSize
    if (patch.sourceLineHeight !== undefined) sourceLineHeight.value = patch.sourceLineHeight
    if (patch.zoom !== undefined) zoom.value = patch.zoom
    if (patch.wordWrap !== undefined) wordWrap.value = patch.wordWrap
    if (patch.wordCountDisplayType !== undefined) wordCountDisplayType.value = patch.wordCountDisplayType
    if (patch.autoSave !== undefined) autoSave.value = patch.autoSave
    if (patch.autoSaveInterval !== undefined) autoSaveInterval.value = patch.autoSaveInterval
  }

  function zoomIn(): void {
    zoom.value = Math.min(200, zoom.value + 10)
    if (window.electronAPI) {
      window.electronAPI.setZoom(zoom.value)
    }
  }

  function zoomOut(): void {
    zoom.value = Math.max(50, zoom.value - 10)
    if (window.electronAPI) {
      window.electronAPI.setZoom(zoom.value)
    }
  }

  function resetZoom(): void {
    zoom.value = 100
    if (window.electronAPI) {
      window.electronAPI.setZoom(zoom.value)
    }
  }

  function toggleWordCountDisplayType(): void {
    wordCountDisplayType.value = wordCountDisplayType.value === 'raw' ? 'rendered' : 'raw'
  }

  return {
    fontSize,
    lineHeight,
    sourceFontSize,
    sourceLineHeight,
    zoom,
    wordWrap,
    wordCountDisplayType,
    autoSave,
    autoSaveInterval,
    applyPatch,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleWordCountDisplayType,
  }
})
