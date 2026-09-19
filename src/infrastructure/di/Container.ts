// ============================================================
// Composition Root – 依赖注入容器
// ============================================================
//
// 在此文件中组装所有依赖关系，实现 DI 容器功能。
// 每个模块只依赖接口，具体实现在此处注入。

import { MilkdownAdapter } from '@infrastructure/adapters/editors/MilkdownAdapter'
import { ImageInsertService } from '@/services/image/ImageInsertService'
import { ImageStorageGateway } from '@adapters/gateways/image/ImageStorageGateway'
import { useFileSystemGateway } from '@adapters/gateways/FileSystemGateway'
import { usePreferencesStore } from '@/stores/preferences'
import { useTabsStore } from '@/stores/tabs'
import { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'
import { initializeEditorGateway } from '@adapters/gateways/EditorServiceGateway'

export function initializeContainer(): void {
  // 获取 Store 实例（Pinia 必须先初始化）
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const fileSystemGateway = useFileSystemGateway()

  // 创建基础设施层依赖
  const imageStorageGateway = new ImageStorageGateway(fileSystemGateway)
  const imageInsertService = new ImageInsertService(imageStorageGateway)

  // 创建适配器工厂函数
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

  // MilkdownAdapter 需要这些函数来创建 ImageContext
  // 但由于循环依赖，我们使用延迟引用
  let adapterInstance: MilkdownAdapter | null = null

  const getImageContext = (): ImageInsertContext => ({
    currentFilePath: tabsStore.activeTab?.filePath ?? undefined,
    currentFileDir: getCurrentFileDir(),
    fileName: undefined,
    editorInsertImage: (url: string, alt?: string) => {
      if (adapterInstance) {
        adapterInstance.insertImage(url, alt || '')
      }
    },
  })

  // 创建 MilkdownAdapter
  adapterInstance = new MilkdownAdapter(
    getCurrentFilePath,
    getCurrentFileDir,
    imageInsertService,
    getImageOptions,
    getImageContext
  )

  // 初始化 EditorServiceGateway
  initializeEditorGateway({ adapter: adapterInstance })
}
