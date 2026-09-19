// ============================================================
// useWritingEnhancement �?写作增强模式 Composable（Adapters Layer�?// ============================================================
//
// 职责：协调打字机模式 / 专注模式�?Vue 生命周期管理�?//   - 监听 ViewModeStore 状态变�?//   - 委托 Use Cases 执行业务逻辑
//   - 仅处�?Vue 特定�?watcher 注册/注销
//
// 依赖方向（Clean Architecture）：
//   Components �?useWritingEnhancement �?Use Cases �?Interfaces
//                                         �?ScrollServiceGateway �?IEditorProvider
//                                         �?ViewModeGateway �?(DOM)

import { watch } from 'vue'
import { useViewModeStore } from '@/stores/viewMode'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import { ScrollServiceGateway } from '@adapters/gateways/ScrollServiceGateway'
import { ViewModeGateway } from '@adapters/gateways/ViewModeGateway'
import { ToggleTypewriterMode } from '@core/use-cases/editor/ToggleTypewriterMode'
import { ToggleFocusMode } from '@core/use-cases/editor/ToggleFocusMode'

// ── 模块级单例（工厂函数模式，与 EditorServiceGateway 一致）────

let instance: {
  toggleTypewriterMode: () => void
  toggleFocusMode: () => void
  initialize: () => void
  cleanup: () => void
  scrollCursorToCenter: () => import('@core/domain/ports/services/IScrollService').ScrollResult
} | null = null

/** 重置单例（仅用于测试�?*/
export function resetWritingEnhancementInstance(): void {
  instance = null
}

/**
 * 公共 API �?导出给组件使�? *
 * 使用工厂函数单例模式：首次调用创建实例并缓存�? * 后续调用返回同一实例�? */
export function useWritingEnhancement() {
  if (instance) return instance

  const viewMode = useViewModeStore()
  let initialized = false
  let storeWatchers: (() => void)[] | null = null

  // Gateway 依赖（Adapters Layer）
  const editorProvider = getEditorServiceGateway()
  const scrollService = new ScrollServiceGateway(editorProvider)
  const viewModeGateway = new ViewModeGateway(editorProvider)

  // Use Cases（Core Layer）- 通过构造函数注入接口
  const typewriterUseCase = new ToggleTypewriterMode(scrollService, viewModeGateway)
  const focusUseCase = new ToggleFocusMode(viewModeGateway)

  function toggleTypewriterMode() {
    const newState = !viewMode.typewriterMode
    typewriterUseCase.applyState(newState)
    viewMode.setTypewriterMode(newState)
  }

  function toggleFocusMode() {
    const newState = !viewMode.focusMode
    focusUseCase.applyState(newState)
    viewMode.setFocusMode(newState)
  }

  // Watcher: �?store 状态变化时重新应用视觉效果
  function applyTypewriterMode() {
    typewriterUseCase.applyState(viewMode.typewriterMode)
  }

  function applyFocusMode() {
    focusUseCase.applyState(viewMode.focusMode)
  }

  function initialize() {
    if (initialized) return
    initialized = true

    applyTypewriterMode()
    applyFocusMode()

    storeWatchers = [
      watch(() => viewMode.typewriterMode, () => {
        applyTypewriterMode()
      }),
      watch(() => viewMode.focusMode, () => {
        applyFocusMode()
      })
    ]
  }

  function cleanup() {
    initialized = false

    scrollService.stopTypewriterMode()

    if (storeWatchers) {
      storeWatchers.forEach(unwatch => unwatch())
      storeWatchers = null
    }

    viewModeGateway.disableAll()
  }

  function scrollCursorToCenter() {
    return scrollService.scrollCursorToPosition()
  }

  instance = {
    toggleTypewriterMode,
    toggleFocusMode,
    initialize,
    cleanup,
    scrollCursorToCenter,
  }

  return instance
}
