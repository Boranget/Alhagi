// ============================================================
// DI Container — 依赖注入容器 (InversifyJS)
// ============================================================
//
// 使用 InversifyJS 实现正式的依赖注入容器。
// 替代手动的工厂函数和单例模式。

import 'reflect-metadata'
import { Container, injectable, inject } from 'inversify'
import { TYPES } from './types'

// Domain Ports
import type { IEditorProvider } from '@core/domain/ports/IEditorProvider'
import type { IEditorCommands } from '@core/domain/ports/IEditorCommands'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { ILayoutRepository } from '@core/domain/ports/repositories/ILayoutRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { IFileSystem } from '@core/domain/ports/gateways/IFileSystem'
import type { IScrollService } from '@core/domain/ports/services/IScrollService'
import type { IViewModeGateway } from '@core/domain/ports/gateways/IViewModeGateway'
import type { IElectronSync } from '@core/domain/ports/gateways/IElectronSync'
import type { ILayoutSync } from '@core/domain/ports/gateways/ILayoutSync'

// Use Cases
import { CreateTab } from '@core/use-cases/tabs/CreateTab'
import { CloseTab } from '@core/use-cases/tabs/CloseTab'
import { SwitchTab } from '@core/use-cases/tabs/SwitchTab'
import { UpdateTab } from '@core/use-cases/tabs/UpdateTab'
import { ExecuteEditorCommand } from '@core/use-cases/editor/ExecuteEditorCommand'
import { ToggleTypewriterMode } from '@core/use-cases/editor/ToggleTypewriterMode'
import { ToggleFocusMode } from '@core/use-cases/editor/ToggleFocusMode'

// Infrastructure Adapters
import { EventBusGateway } from '@adapters/gateways/EventBusGateway'
import { FileSystemGateway } from '@adapters/gateways/FileSystemGateway'
import { ScrollServiceGateway } from '@adapters/gateways/ScrollServiceGateway'
import { ViewModeGateway } from '@adapters/gateways/ViewModeGateway'
import { ElectronSyncGateway } from '@adapters/gateways/ElectronSyncGateway'
import { LayoutSyncGateway } from '@adapters/gateways/LayoutSyncGateway'
import { initializeEditorGateway, getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import { MilkdownAdapter } from '@infrastructure/adapters/editors/MilkdownAdapter'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import { ImageStorageGateway } from '@adapters/gateways/image/ImageStorageGateway'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'

// Adapter Stores
import { useTabsStore } from '@/stores/tabs'
import { useLayoutRepository } from '@adapters/stores/layout'
import { usePreferencesStore } from '@/stores/preferences'
import { useViewModeStore } from '@/stores/viewMode'

// Managers
import { EditorCommands } from '@/managers/EditorCommands'

// 创建容器
const container = new Container()

// 绑定 ports 到 adapters — 保持 toDynamicValue + inSingletonScope 以避免装饰器兼容问题
container.bind<IEventBus>(TYPES.EventBus).toDynamicValue(() => new EventBusGateway()).inSingletonScope()
container.bind<IFileSystem>(TYPES.FileSystem).toDynamicValue(() => new FileSystemGateway()).inSingletonScope()
container.bind<IElectronSync>(TYPES.ElectronSync).toDynamicValue(() => new ElectronSyncGateway()).inSingletonScope()
container.bind<ILayoutSync>(TYPES.LayoutSync).toDynamicValue(() => new LayoutSyncGateway()).inSingletonScope()
container.bind<ITabRepository>(TYPES.TabRepository).toDynamicValue(() => useTabsStore()).inSingletonScope()
container.bind<ILayoutRepository>(TYPES.LayoutRepository).toDynamicValue(() => useLayoutRepository()).inSingletonScope()

// 动态绑定（需要运行时获取实例）
container.bind<IEditorProvider>(TYPES.EditorProvider).toDynamicValue(() => {
  return getEditorServiceGateway()
}).inSingletonScope()

container.bind<IEditorCommands>(TYPES.EditorCommands).toDynamicValue(() => {
  const gateway = getEditorServiceGateway()
  return new EditorCommands(() => gateway.getActiveCrepe())
}).inSingletonScope()

container.bind<IScrollService>(TYPES.ScrollService).toDynamicValue(() => {
  const editorProvider = container.get<IEditorProvider>(TYPES.EditorProvider)
  return new ScrollServiceGateway(editorProvider)
}).inSingletonScope()

container.bind<IViewModeGateway>(TYPES.ViewModeGateway).toDynamicValue(() => {
  const editorProvider = container.get<IEditorProvider>(TYPES.EditorProvider)
  return new ViewModeGateway(editorProvider)
}).inSingletonScope()

// 绑定 Use Cases
container.bind<CreateTab>(TYPES.CreateTabUseCase).toDynamicValue(() => {
  return new CreateTab(
    container.get<ITabRepository>(TYPES.TabRepository),
    container.get<IEventBus>(TYPES.EventBus),
    container.get<IElectronSync>(TYPES.ElectronSync)
  )
}).inSingletonScope()

container.bind<CloseTab>(TYPES.CloseTabUseCase).toDynamicValue(() => {
  return new CloseTab(
    container.get<ITabRepository>(TYPES.TabRepository),
    container.get<IEventBus>(TYPES.EventBus),
    container.get<IElectronSync>(TYPES.ElectronSync)
  )
}).inSingletonScope()

container.bind<SwitchTab>(TYPES.SwitchTabUseCase).toDynamicValue(() => {
  return new SwitchTab(
    container.get<ITabRepository>(TYPES.TabRepository),
    container.get<IEventBus>(TYPES.EventBus)
  )
}).inSingletonScope()

container.bind<UpdateTab>(TYPES.UpdateTabUseCase).toDynamicValue(() => {
  return new UpdateTab(
    container.get<ITabRepository>(TYPES.TabRepository),
    container.get<IEventBus>(TYPES.EventBus)
  )
}).inSingletonScope()

container.bind<ExecuteEditorCommand>(TYPES.ExecuteEditorCommandUseCase).toDynamicValue(() => {
  return new ExecuteEditorCommand(
    container.get<IEditorCommands>(TYPES.EditorCommands)
  )
}).inSingletonScope()

container.bind<ToggleTypewriterMode>(TYPES.ToggleTypewriterModeUseCase).toDynamicValue(() => {
  return new ToggleTypewriterMode(
    container.get<IScrollService>(TYPES.ScrollService),
    container.get<IViewModeGateway>(TYPES.ViewModeGateway)
  )
}).inSingletonScope()

container.bind<ToggleFocusMode>(TYPES.ToggleFocusModeUseCase).toDynamicValue(() => {
  return new ToggleFocusMode(
    container.get<IViewModeGateway>(TYPES.ViewModeGateway)
  )
}).inSingletonScope()

// 初始化函数 - 在 Composition Root 调用
export function initializeContainer(): void {
  // Initialize dependencies for MilkdownAdapter
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const fileSystemGateway = new FileSystemGateway()
  const imageStorageGateway = new ImageStorageGateway(fileSystemGateway)
  const imageInsertService = new ImageInsertService(imageStorageGateway)

  const getCurrentFilePath = () => tabsStore.activeTab?.filePath ?? undefined
  const getCurrentFileDir = () => {
    const path = tabsStore.activeTab?.filePath
    if (!path) return undefined
    const lastSlash = path.lastIndexOf('/')
    const lastBackslash = path.lastIndexOf('\\')
    const lastSep = Math.max(lastSlash, lastBackslash)
    return lastSep > 0 ? path.substring(0, lastSep) : undefined
  }
  const getImageOptions = (): ImageInsertOptions => {
    const baseOptions = ImageInsertOptions.createDefault()
    return new ImageInsertOptions({
      ...baseOptions.toProps(),
      mode: prefsStore.imageInsertMode,
      copyPath: prefsStore.imageCopyPath,
      preferRelativePath: prefsStore.imagePreferRelativePath,
      applyToLocal: prefsStore.imageApplyToLocal,
      applyToRemote: prefsStore.imageApplyToRemote,
      escapeUrl: prefsStore.imageEscapeUrl,
    })
  }
  const getImageContext = (): ImageInsertContext => ({
    currentFilePath: tabsStore.activeTab?.filePath ?? undefined,
    currentFileDir: getCurrentFileDir(),
    fileName: undefined,
    editorInsertImage: (url: string, alt?: string) => {
      adapter.insertImage(url, alt || '')
    },
  })

  const adapter = new MilkdownAdapter(
    getCurrentFilePath,
    getCurrentFileDir,
    imageInsertService,
    getImageOptions,
    getImageContext,
    () => useViewModeStore().focusMode,
    container.get<ITabRepository>(TYPES.TabRepository)
  )

  initializeEditorGateway({ adapter })
}

export { container }
