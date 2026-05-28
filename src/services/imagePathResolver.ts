import { useTabsStore } from '@/stores/tabs'
import { resolveImagePath } from '@/utils/tempImageManager'
import { resolveImageToDisplayUrl } from '@/utils/helpers'

export class ImagePathResolver {
  private static instance: ImagePathResolver

  private constructor() {}

  public static getInstance(): ImagePathResolver {
    if (!ImagePathResolver.instance) {
      ImagePathResolver.instance = new ImagePathResolver()
    }
    return ImagePathResolver.instance
  }

  public async resolve(src: string, fileId: string): Promise<string> {
    const tabsStore = useTabsStore()
    const tab = Array.from(tabsStore.tabs.values()).find(t => t.id === fileId)
    
    if (!tab) {
      return this.handleFallback(src)
    }

    // 网络 URL → 原样返回
    if (/^https?:\/\//.test(src)) {
      return src
    }

    // file:// 协议 → 原样返回
    if (src.startsWith('file://')) {
      return src
    }

    // data: URL → 原样返回
    if (src.startsWith('data:')) {
      return src
    }

    // 绝对路径（Windows 或 Unix）→ 直接转为 file:// 协议
    const normalized = src.replace(/\\/g, '/')
    if (/^[A-Za-z]:[\\/]/.test(normalized) || normalized.startsWith('/')) {
      if (/^[A-Za-z]:[\\/]/.test(normalized)) {
        return 'file:///' + normalized
      }
      return 'file://' + normalized
    }

    // 有文件路径 → 使用 resolveImageToDisplayUrl
    if (tab.filePath) {
      return resolveImageToDisplayUrl(src, tab.filePath)
    }

    // 无文件路径 → 临时目录解析
    return await resolveImagePath(src, fileId)
  }

  private handleFallback(src: string): string {
    // 简单的回退逻辑
    if (/^https?:\/\//.test(src)) return src
    if (src.startsWith('file://')) return src
    if (src.startsWith('data:')) return src
    
    const normalized = src.replace(/\\/g, '/')
    if (/^[A-Za-z]:[\\/]/.test(normalized)) {
      return 'file:///' + normalized
    }
    if (normalized.startsWith('/')) {
      return 'file://' + normalized
    }
    
    return src
  }

  public async resolveForCurrentFile(src: string): Promise<string> {
    const tabsStore = useTabsStore()
    const activeTab = tabsStore.activeTab
    
    if (!activeTab) {
      return this.handleFallback(src)
    }

    return await this.resolve(src, activeTab.id)
  }

  public getCurrentFileId(): string | null {
    const tabsStore = useTabsStore()
    return tabsStore.activeTab?.id || null
  }

  public hasFilePath(fileId: string): boolean {
    const tabsStore = useTabsStore()
    const tab = Array.from(tabsStore.tabs.values()).find(t => t.id === fileId)
    return !!tab?.filePath
  }
}

export const imagePathResolver = ImagePathResolver.getInstance()