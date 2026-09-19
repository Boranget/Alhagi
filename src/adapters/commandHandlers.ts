// ============================================================
// Command Handler Adapters – 命令处理器适配层
// ============================================================
//
// 将 Command Handlers 与 Use Cases 连接。
// 提供工厂函数创建 Use Cases 实例，供命令处理器使用。

import { CreateTab } from '@core/use-cases/tabs/CreateTab'
import { CloseTab } from '@core/use-cases/tabs/CloseTab'
import { SaveFile } from '@core/use-cases/file/SaveFile'
import { EventBusGateway } from '@adapters/gateways/EventBusGateway'
import { useTabRepository } from '@adapters/stores/tabs'
import { useFileSystemGateway } from '@adapters/gateways/FileSystemGateway'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'

// 单例实例
let createTabUseCase: CreateTab | null = null
let closeTabUseCase: CloseTab | null = null
let saveFileUseCase: SaveFile | null = null

function getOrCreateTabRepository() {
  return useTabRepository()
}

function getOrCreateEventBus() {
  return new EventBusGateway()
}

function getOrCreateFileSystem() {
  return useFileSystemGateway()
}

function getOrCreateEditorProvider() {
  return getEditorServiceGateway()
}

export function getCreateTabUseCase(): CreateTab {
  if (!createTabUseCase) {
    createTabUseCase = new CreateTab(
      getOrCreateTabRepository(),
      getOrCreateEventBus()
    )
  }
  return createTabUseCase
}

export function getCloseTabUseCase(): CloseTab {
  if (!closeTabUseCase) {
    closeTabUseCase = new CloseTab(
      getOrCreateTabRepository(),
      getOrCreateEventBus()
    )
  }
  return closeTabUseCase
}

export function getSaveFileUseCase(): SaveFile {
  if (!saveFileUseCase) {
    saveFileUseCase = new SaveFile(
      getOrCreateFileSystem(),
      getOrCreateTabRepository(),
      getOrCreateEventBus()
    )
  }
  return saveFileUseCase
}

// 重置单例（用于测试）
export function resetCommandHandlerAdapters(): void {
  createTabUseCase = null
  closeTabUseCase = null
  saveFileUseCase = null
}
