// ============================================================
// Command Handler Adapters – 命令处理器适配层
// ============================================================
//
// 将 Command Handlers 与 Use Cases 连接。
// 使用 InversifyJS DI 容器获取 Use Cases 实例。

import { container } from '@infrastructure/di/Container'
import { TYPES } from '@infrastructure/di/types'
import { CreateTab } from '@core/use-cases/tabs/CreateTab'
import { CloseTab } from '@core/use-cases/tabs/CloseTab'
import { SwitchTab } from '@core/use-cases/tabs/SwitchTab'
import { UpdateTab } from '@core/use-cases/tabs/UpdateTab'
import { ExecuteEditorCommand } from '@core/use-cases/editor/ExecuteEditorCommand'
import { ToggleTypewriterMode } from '@core/use-cases/editor/ToggleTypewriterMode'
import { ToggleFocusMode } from '@core/use-cases/editor/ToggleFocusMode'
import { EventBusGateway } from '@adapters/gateways/EventBusGateway'
import { useTabsStore } from '@/stores/tabs'
import { useFileSystemGateway } from '@adapters/gateways/FileSystemGateway'

// 获取 Use Cases（从 DI 容器）
export function getCreateTabUseCase(): CreateTab {
  return container.get<CreateTab>(TYPES.CreateTabUseCase)
}

export function getCloseTabUseCase(): CloseTab {
  return container.get<CloseTab>(TYPES.CloseTabUseCase)
}

export function getSwitchTabUseCase(): SwitchTab {
  return container.get<SwitchTab>(TYPES.SwitchTabUseCase)
}

export function getUpdateTabUseCase(): UpdateTab {
  return container.get<UpdateTab>(TYPES.UpdateTabUseCase)
}

export function getExecuteEditorCommandUseCase(): ExecuteEditorCommand {
  return container.get<ExecuteEditorCommand>(TYPES.ExecuteEditorCommandUseCase)
}

export function getToggleTypewriterModeUseCase(): ToggleTypewriterMode {
  return container.get<ToggleTypewriterMode>(TYPES.ToggleTypewriterModeUseCase)
}

export function getToggleFocusModeUseCase(): ToggleFocusMode {
  return container.get<ToggleFocusMode>(TYPES.ToggleFocusModeUseCase)
}

// 保持兼容性（用于测试）
export function resetCommandHandlerAdapters(): void {
  // InversifyJS 容器不需要重置
}
